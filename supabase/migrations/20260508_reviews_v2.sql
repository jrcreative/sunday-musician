-- Bidirectional review system, Airbnb-style.
--
-- Both parties can review each other after a booking. Reviews are HIDDEN
-- from the other party until either (a) both sides submit or (b) the 7-day
-- window expires (handled by the daily cron). RLS enforces visibility.
--
-- This migration:
--   1. Creates a real `bookings` table (was previously derived from
--      accepted-proposal messages) so reviews have a stable id to attach to.
--   2. Replaces the old single-direction `reviews` table with a per-direction
--      structure tied to `review_periods`.
--   3. Adds triggers that (a) auto-create a booking + period when a proposal
--      is accepted and (b) auto-release a period when both sides submit.
--   4. Backfills bookings + periods for existing accepted proposals.

-- ------------------------------------------------------------------ bookings

create table bookings (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references service_requests on delete cascade,
  thread_id           uuid not null references threads on delete cascade unique,
  church_profile_id   uuid not null references church_profiles on delete cascade,
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  service_date        date not null,
  fee                 int,
  fee_type            text,
  accepted_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index bookings_musician_idx on bookings (musician_profile_id, service_date);
create index bookings_church_idx   on bookings (church_profile_id, service_date);

alter table bookings enable row level security;

create policy "Booking participants can read"
  on bookings for select using (
    musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
    or church_profile_id in (select id from church_profiles where profile_id = auth.uid())
  );

-- ----------------------------------------------------------- review_periods

create table review_periods (
  id                       uuid primary key default gen_random_uuid(),
  booking_id               uuid not null references bookings on delete cascade unique,
  reveal_at                timestamptz not null,    -- service_date + 7 days
  released_at              timestamptz,             -- null = pending, set on dual-submit or expiry
  -- Per-side email tracking so the daily cron is idempotent.
  -- *_musician_at columns track emails to the musician; *_church_at to the church.
  prompt_musician_at       timestamptz,
  prompt_church_at         timestamptz,
  reminder_musician_at     timestamptz,
  reminder_church_at       timestamptz,
  released_email_musician_at timestamptz,
  released_email_church_at   timestamptz,
  created_at               timestamptz not null default now()
);

create index review_periods_reveal_at_idx on review_periods (reveal_at) where released_at is null;

alter table review_periods enable row level security;

create policy "Period participants can read"
  on review_periods for select using (
    booking_id in (
      select id from bookings
      where musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
         or church_profile_id in (select id from church_profiles where profile_id = auth.uid())
    )
  );

-- ------------------------------------------------------------------ reviews

-- Old reviews table was single-direction; drop and recreate.
drop table if exists reviews cascade;

create type reviewer_role as enum ('musician', 'church');

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  period_id     uuid not null references review_periods on delete cascade,
  reviewer_role reviewer_role not null,
  rating        int not null check (rating between 1 and 5),
  body          text not null check (length(trim(body)) > 0),
  submitted_at  timestamptz not null default now(),
  unique (period_id, reviewer_role)
);

create index reviews_period_idx on reviews (period_id);

alter table reviews enable row level security;

-- Released reviews are public (this is what makes profile pages work).
create policy "Released reviews are public"
  on reviews for select using (
    exists (
      select 1 from review_periods rp
      where rp.id = period_id and rp.released_at is not null
    )
  );

-- Before release, only the reviewer can see their own review (so they can
-- edit before submitting elsewhere — and to avoid retaliation).
create policy "Reviewers can read own pending review"
  on reviews for select using (
    period_id in (
      select rp.id from review_periods rp
      join bookings b on b.id = rp.booking_id
      where (
        reviewer_role = 'musician' and b.musician_profile_id in
          (select id from musician_profiles where profile_id = auth.uid())
      ) or (
        reviewer_role = 'church' and b.church_profile_id in
          (select id from church_profiles where profile_id = auth.uid())
      )
    )
  );

create policy "Participants can submit own review"
  on reviews for insert with check (
    period_id in (
      select rp.id from review_periods rp
      join bookings b on b.id = rp.booking_id
      where (
        reviewer_role = 'musician' and b.musician_profile_id in
          (select id from musician_profiles where profile_id = auth.uid())
      ) or (
        reviewer_role = 'church' and b.church_profile_id in
          (select id from church_profiles where profile_id = auth.uid())
      )
    )
  );

-- ------------------------------------------ trigger: auto-release on dual-submit

create or replace function maybe_release_review_period()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update review_periods
  set released_at = now()
  where id = new.period_id
    and released_at is null
    and (select count(*) from reviews where period_id = new.period_id) >= 2;
  return new;
end;
$$;

create trigger trg_maybe_release_review_period
after insert on reviews
for each row execute function maybe_release_review_period();

-- ------------------- trigger: create booking + period on proposal acceptance

create or replace function handle_proposal_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread  threads%rowtype;
  v_request service_requests%rowtype;
  v_fee     int;
  v_fee_type text;
  v_booking_id uuid;
begin
  if new.proposal_status = 'accepted'
     and (old.proposal_status is null or old.proposal_status <> 'accepted') then

    select * into v_thread from threads where id = new.thread_id;
    if v_thread.request_id is null then return new; end if;

    select * into v_request from service_requests where id = v_thread.request_id;
    if not found then return new; end if;

    v_fee := nullif((new.proposal->>'fee'), '')::int;
    v_fee_type := coalesce(new.proposal->>'feeType', v_request.fee_type);

    insert into bookings (request_id, thread_id, church_profile_id, musician_profile_id,
                          service_date, fee, fee_type)
    values (v_request.id, v_thread.id, v_thread.church_profile_id, v_thread.musician_profile_id,
            v_request.service_date, v_fee, v_fee_type)
    on conflict (thread_id) do nothing
    returning id into v_booking_id;

    if v_booking_id is not null then
      insert into review_periods (booking_id, reveal_at)
      values (v_booking_id, (v_request.service_date::timestamptz + interval '7 days'));
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_handle_proposal_accepted
after update on messages
for each row execute function handle_proposal_accepted();

-- ----------------------------- backfill: existing accepted proposals → bookings

do $$
declare
  rec record;
  v_booking_id uuid;
begin
  for rec in
    select m.proposal,
           t.id as thread_id, t.church_profile_id, t.musician_profile_id,
           sr.id as request_id, sr.service_date, sr.fee_type
    from messages m
    join threads t on t.id = m.thread_id
    join service_requests sr on sr.id = t.request_id
    where m.proposal_status = 'accepted'
  loop
    insert into bookings (request_id, thread_id, church_profile_id, musician_profile_id,
                          service_date, fee, fee_type)
    values (rec.request_id, rec.thread_id, rec.church_profile_id, rec.musician_profile_id,
            rec.service_date,
            nullif((rec.proposal->>'fee'), '')::int,
            coalesce(rec.proposal->>'feeType', rec.fee_type))
    on conflict (thread_id) do nothing
    returning id into v_booking_id;

    if v_booking_id is not null then
      insert into review_periods (booking_id, reveal_at)
      values (v_booking_id, (rec.service_date::timestamptz + interval '7 days'));
    end if;
  end loop;
end $$;

-- ------- aggregate rating: refresh musician_profiles when a period is released

create or replace function refresh_musician_rating_for_period(p_period_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_musician_id uuid;
begin
  select b.musician_profile_id into v_musician_id
  from review_periods rp join bookings b on b.id = rp.booking_id
  where rp.id = p_period_id;
  if v_musician_id is null then return; end if;

  update musician_profiles set
    rating = coalesce((
      select round(avg(r.rating)::numeric, 1)
      from reviews r
      join review_periods rp on rp.id = r.period_id and rp.released_at is not null
      join bookings b on b.id = rp.booking_id
      where b.musician_profile_id = v_musician_id
        and r.reviewer_role = 'church'
    ), 0),
    review_count = (
      select count(*) from reviews r
      join review_periods rp on rp.id = r.period_id and rp.released_at is not null
      join bookings b on b.id = rp.booking_id
      where b.musician_profile_id = v_musician_id
        and r.reviewer_role = 'church'
    )
  where id = v_musician_id;
end;
$$;

create or replace function trg_refresh_rating_on_release()
returns trigger language plpgsql as $$
begin
  if new.released_at is not null and old.released_at is null then
    perform refresh_musician_rating_for_period(new.id);
  end if;
  return new;
end;
$$;

create trigger trg_review_period_released
after update on review_periods
for each row execute function trg_refresh_rating_on_release();

-- ------------------------ helper view: each side's view of a period (for app)

-- Returns one row per period with whether each side has submitted, used by
-- the /reviews page and dashboard tile to find pending periods quickly.
create or replace view review_period_status as
select
  rp.id as period_id,
  rp.booking_id,
  rp.reveal_at,
  rp.released_at,
  b.musician_profile_id,
  b.church_profile_id,
  b.service_date,
  exists (
    select 1 from reviews r
    where r.period_id = rp.id and r.reviewer_role = 'musician'
  ) as musician_submitted,
  exists (
    select 1 from reviews r
    where r.period_id = rp.id and r.reviewer_role = 'church'
  ) as church_submitted
from review_periods rp
join bookings b on b.id = rp.booking_id;
