-- Structured experience and compatibility fields for musician profiles.
-- Replaces the open-ended experience_notes textarea with queryable columns
-- that the matching algorithm can use.

alter table musician_profiles
  add column if not exists years_in_ministry    int,
  add column if not exists church_size_tags     text[] not null default '{}',
  add column if not exists paid_previously      boolean,
  add column if not exists practice_time_needed text,
  add column if not exists lead_time_preference text,
  add column if not exists music_format_tags    text[] not null default '{}';
