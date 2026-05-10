-- Cancellation policy metadata + dispute foundation.
--
-- Booking cancellation already existed as cancelled_at/cancelled_by/cancel_reason.
-- This migration makes the policy decision explicit and queryable, and creates
-- a participant-visible dispute table for late/contested cancellations.

alter table bookings add column if not exists cancel_category text;
alter table bookings add column if not exists cancellation_policy_label text;
alter table bookings add column if not exists cancellation_policy jsonb not null default '{}'::jsonb;
alter table bookings add column if not exists dispute_review_required boolean not null default false;

create index if not exists bookings_dispute_review_idx
  on bookings (cancelled_at desc)
  where dispute_review_required = true;

create table if not exists booking_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings on delete cascade,
  opened_by_profile_id uuid not null references profiles on delete cascade,
  opened_by_role text not null check (opened_by_role in ('church', 'musician')),
  category text not null default 'cancellation',
  reason text,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'closed')),
  admin_notes text,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (booking_id, opened_by_role, category)
);

create index if not exists booking_disputes_booking_idx on booking_disputes (booking_id);
create index if not exists booking_disputes_status_idx on booking_disputes (status, created_at desc);

alter table booking_disputes enable row level security;

create policy "Dispute participants can read"
  on booking_disputes for select using (
    booking_id in (
      select id from bookings
      where musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
         or church_profile_id in (select id from church_profiles where profile_id = auth.uid())
    )
    or is_admin(auth.uid())
  );

create policy "Booking participants can open disputes"
  on booking_disputes for insert with check (
    opened_by_profile_id = auth.uid()
    and booking_id in (
      select id from bookings
      where (
        opened_by_role = 'musician'
        and musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
      ) or (
        opened_by_role = 'church'
        and church_profile_id in (select id from church_profiles where profile_id = auth.uid())
      )
    )
  );

-- No participant update/delete policy yet. Admins work through service-role
-- routes/pages so resolution changes are auditable when added.
