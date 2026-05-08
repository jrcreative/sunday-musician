alter table musician_profiles
  add column if not exists experience_notes text not null default '',
  add column if not exists gear_notes text not null default '',
  add column if not exists profile_videos jsonb not null default '[]'::jsonb;

update musician_profiles
set profile_videos = (
  select coalesce(
    jsonb_agg(jsonb_build_object('url', link, 'title', '', 'description', '')),
    '[]'::jsonb
  )
  from unnest(youtube_links) as link
  where nullif(trim(link), '') is not null
)
where profile_videos = '[]'::jsonb
  and coalesce(array_length(youtube_links, 1), 0) > 0;

alter table musician_profiles
  drop column if exists years_experience;
