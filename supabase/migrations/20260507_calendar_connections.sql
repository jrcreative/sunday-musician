-- Layer 2: iCal feed subscriptions. Layers 3+ (Google OAuth, PCO) reuse this
-- table with different `kind` values and store provider-specific data in the
-- jsonb `meta` column.

create type calendar_kind as enum ('ical', 'google', 'pco');

create table calendar_connections (
  id                  uuid primary key default gen_random_uuid(),
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  kind                calendar_kind not null,
  label               text not null,
  ical_url            text,
  meta                jsonb not null default '{}'::jsonb,
  last_synced_at      timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  -- ical connections must have a URL; OAuth-based ones may not.
  check (kind <> 'ical' or ical_url is not null)
);

create index calendar_connections_musician_idx
  on calendar_connections (musician_profile_id);

alter table calendar_connections enable row level security;

create policy "Musicians manage own calendar connections"
  on calendar_connections for all
  using (
    musician_profile_id in (
      select id from musician_profiles where profile_id = auth.uid()
    )
  )
  with check (
    musician_profile_id in (
      select id from musician_profiles where profile_id = auth.uid()
    )
  );

-- Tie blocks to the connection that produced them. Deleting a connection
-- removes its synced blocks atomically. Manual blocks have connection_id null.
alter table unavailability_blocks
  add column connection_id uuid references calendar_connections on delete cascade;

-- Replace the old uniqueness key (per-musician+source+external_id) with one
-- that's per-connection. Two iCal feeds could legitimately share a UID.
drop index if exists unavailability_blocks_external_uniq;
create unique index unavailability_blocks_connection_external_uniq
  on unavailability_blocks (connection_id, external_id)
  where connection_id is not null and external_id is not null;

create index unavailability_blocks_connection_idx
  on unavailability_blocks (connection_id);
