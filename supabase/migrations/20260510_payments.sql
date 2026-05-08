-- Stripe Connect payments.
--
-- Three new tables:
--   1. stripe_accounts — one row per musician profile, holds connected
--      account id and onboarding/capability flags.
--   2. stripe_customers — one row per church profile, holds customer id and
--      default saved payment method.
--   3. payments — one row per booking, full lifecycle from "scheduled"
--      (booking confirmed, will charge on event day) through "captured"
--      (charged successfully) or "failed"/"cancelled".
--
-- Money flow: church saves a card (SetupIntent, no charge). When the
-- musician accepts the proposal, a payments row is created in 'scheduled'.
-- On the morning of the service date, a cron creates+confirms a
-- PaymentIntent off-session with destination=connected account and
-- application_fee_amount=$5 + grossed-up Stripe fees. If the booking is
-- cancelled before the event, the payment row goes to 'cancelled' and no
-- money moves.
--
-- bookings gets a cancelled_at column so the cron can skip cancelled rows
-- without joining payments. Triggers keep payments in sync with bookings.

-- -------------------------------------------------------- stripe_accounts (musicians)

create table if not exists stripe_accounts (
  id                   uuid primary key default gen_random_uuid(),
  musician_profile_id  uuid not null unique references musician_profiles on delete cascade,
  stripe_account_id    text not null unique,
  charges_enabled      boolean not null default false,
  payouts_enabled      boolean not null default false,
  details_submitted    boolean not null default false,
  requirements_due     jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists stripe_accounts_acct_idx on stripe_accounts (stripe_account_id);

alter table stripe_accounts enable row level security;

create policy "Musicians can read own stripe account"
  on stripe_accounts for select using (
    musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
  );

-- Inserts/updates happen exclusively via service-role API routes.

-- -------------------------------------------------------- stripe_customers (churches)

create table if not exists stripe_customers (
  id                       uuid primary key default gen_random_uuid(),
  church_profile_id        uuid not null unique references church_profiles on delete cascade,
  stripe_customer_id       text not null unique,
  default_payment_method   text,
  card_brand               text,
  card_last4               text,
  card_exp_month           int,
  card_exp_year            int,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists stripe_customers_cust_idx on stripe_customers (stripe_customer_id);

alter table stripe_customers enable row level security;

create policy "Churches can read own stripe customer"
  on stripe_customers for select using (
    church_profile_id in (select id from church_profiles where profile_id = auth.uid())
  );

-- ------------------------------------------------------------------ bookings.cancelled_at

alter table bookings add column if not exists cancelled_at  timestamptz;
alter table bookings add column if not exists cancelled_by  text;  -- 'church' | 'musician'
alter table bookings add column if not exists cancel_reason text;

-- ------------------------------------------------------------------ payments

create type payment_status as enum (
  'scheduled',  -- booking confirmed, awaiting event-day charge
  'capturing',  -- cron has started a PaymentIntent
  'captured',   -- successfully charged
  'failed',     -- charge attempted and declined / errored
  'cancelled'   -- booking cancelled before charge
);

create table if not exists payments (
  id                        uuid primary key default gen_random_uuid(),
  booking_id                uuid not null unique references bookings on delete cascade,
  church_profile_id         uuid not null references church_profiles on delete cascade,
  musician_profile_id       uuid not null references musician_profiles on delete cascade,
  status                    payment_status not null default 'scheduled',

  -- Amounts in cents, all USD.
  musician_amount           int not null,    -- sent to musician (the quoted fee)
  platform_fee              int not null,    -- our $5 (500)
  stripe_fee_estimate       int not null,    -- estimated Stripe processing fee at booking time
  application_fee_amount    int not null,    -- platform_fee + stripe_fee → on the PI
  charge_total              int not null,    -- total to charge the church

  -- Stripe identifiers, populated as the lifecycle progresses.
  stripe_payment_intent_id  text,
  stripe_charge_id          text,
  stripe_customer_id        text not null,
  stripe_destination_id     text not null,  -- connected acct id at booking time
  stripe_payment_method_id  text not null,  -- card on file at booking time

  scheduled_for             date not null,  -- service_date — cron's "today" filter
  attempted_at              timestamptz,
  captured_at               timestamptz,
  failed_at                 timestamptz,
  failure_message           text,
  cancelled_at              timestamptz,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists payments_status_scheduled_idx
  on payments (scheduled_for) where status = 'scheduled';
create index if not exists payments_pi_idx on payments (stripe_payment_intent_id);
create index if not exists payments_church_idx on payments (church_profile_id);
create index if not exists payments_musician_idx on payments (musician_profile_id);

alter table payments enable row level security;

create policy "Payment participants can read"
  on payments for select using (
    musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
    or church_profile_id in (select id from church_profiles where profile_id = auth.uid())
  );

-- Inserts/updates: service role only. (App server actions use the service
-- key indirectly via API routes that validate ownership before mutating.)

-- ----------------------------- trigger: cancel booking ⇒ cancel scheduled payment

create or replace function cancel_payment_on_booking_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cancelled_at is not null
     and (old.cancelled_at is null or old.cancelled_at <> new.cancelled_at) then
    update payments
    set status       = 'cancelled',
        cancelled_at = new.cancelled_at,
        updated_at   = now()
    where booking_id = new.id
      and status = 'scheduled';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cancel_payment_on_booking_cancel on bookings;
create trigger trg_cancel_payment_on_booking_cancel
after update on bookings
for each row execute function cancel_payment_on_booking_cancel();

-- ----------------------------- updated_at touchers

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_stripe_accounts on stripe_accounts;
create trigger trg_touch_stripe_accounts before update on stripe_accounts
  for each row execute function touch_updated_at();

drop trigger if exists trg_touch_stripe_customers on stripe_customers;
create trigger trg_touch_stripe_customers before update on stripe_customers
  for each row execute function touch_updated_at();

drop trigger if exists trg_touch_payments on payments;
create trigger trg_touch_payments before update on payments
  for each row execute function touch_updated_at();
