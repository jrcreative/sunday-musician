-- Churches can decline a potential match for a specific request so that
-- musician stops appearing in the request's match list. Scoped per request:
-- declining here does not hide the musician from other requests or browse.

create table request_match_dismissals (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references service_requests on delete cascade,
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  created_at          timestamptz not null default now(),
  unique (request_id, musician_profile_id)
);

create index request_match_dismissals_request_idx
  on request_match_dismissals (request_id);

alter table request_match_dismissals enable row level security;

create policy "Churches manage own request dismissals"
  on request_match_dismissals for all
  using (
    request_id in (
      select sr.id from service_requests sr
      join church_profiles cp on cp.id = sr.church_profile_id
      where cp.profile_id = auth.uid()
    )
  )
  with check (
    request_id in (
      select sr.id from service_requests sr
      join church_profiles cp on cp.id = sr.church_profile_id
      where cp.profile_id = auth.uid()
    )
  );
