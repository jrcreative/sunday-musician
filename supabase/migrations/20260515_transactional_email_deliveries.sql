create type email_delivery_status as enum ('sending', 'sent', 'failed', 'skipped');
create type email_delivery_category as enum ('critical', 'payment', 'activity', 'system');

create table email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  category email_delivery_category not null,
  dedupe_key text not null unique,
  recipient_profile_id uuid references profiles on delete set null,
  to_email text not null,
  subject text not null,
  template_id text,
  payload jsonb not null default '{}'::jsonb,
  status email_delivery_status not null default 'sending',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_deliveries_recipient_idx on email_deliveries (recipient_profile_id, created_at desc);
create index email_deliveries_event_idx on email_deliveries (event_key, created_at desc);
create index email_deliveries_status_idx on email_deliveries (status, created_at desc);

alter table email_deliveries enable row level security;

create policy "Admins can read email deliveries"
  on email_deliveries for select
  using (exists (
    select 1 from profiles
    where id = auth.uid()
      and is_admin = true
      and deleted_at is null
  ));

drop trigger if exists trg_touch_email_deliveries on email_deliveries;
create trigger trg_touch_email_deliveries before update on email_deliveries
for each row execute function touch_updated_at();
