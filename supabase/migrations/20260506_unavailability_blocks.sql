-- Layer 1 of musician calendar: manual unavailability blocks.
-- Layers 2 (iCal feeds) and 3 (Google / PCO OAuth) will write into the same
-- table with different `source` values, so all consumers query one place.

create type unavailability_source as enum ('manual', 'ical', 'google', 'pco');

create table unavailability_blocks (
  id                  uuid primary key default gen_random_uuid(),
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  start_date          date not null,
  end_date            date not null,
  source              unavailability_source not null default 'manual',
  external_id         text,
  note                text,
  created_at          timestamptz not null default now(),
  check (end_date >= start_date)
);

create index unavailability_blocks_musician_range_idx
  on unavailability_blocks (musician_profile_id, start_date, end_date);

-- Prevent duplicate sync inserts when an external source is reconnected.
create unique index unavailability_blocks_external_uniq
  on unavailability_blocks (musician_profile_id, source, external_id)
  where external_id is not null;

alter table unavailability_blocks enable row level security;

-- Anyone can read blocks (so churches can see availability when filtering),
-- but bodies don't expose event titles — only the date range.
create policy "Anyone can read unavailability blocks"
  on unavailability_blocks for select using (true);

create policy "Musicians manage own blocks"
  on unavailability_blocks for all
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

-- Single availability check used everywhere (request filters, browse, etc.)
-- Returns false if the master `available` toggle is off OR any block covers the date.
create or replace function is_musician_available(
  p_musician_id uuid,
  p_date date
)
returns boolean
language sql
stable
as $$
  select
    coalesce((select available from musician_profiles where id = p_musician_id), false)
    and not exists (
      select 1 from unavailability_blocks
      where musician_profile_id = p_musician_id
        and p_date between start_date and end_date
    );
$$;
