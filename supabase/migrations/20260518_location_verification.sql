alter table musician_profiles
  add column if not exists formatted_address text,
  add column if not exists address_verified_at timestamptz;

alter table church_profiles
  add column if not exists formatted_address text,
  add column if not exists address_verified_at timestamptz;

alter table service_requests
  add column if not exists use_church_location boolean not null default true,
  add column if not exists location_address text,
  add column if not exists location_city text,
  add column if not exists location_state text,
  add column if not exists location_zip text,
  add column if not exists location_lat numeric,
  add column if not exists location_lng numeric,
  add column if not exists location_formatted_address text,
  add column if not exists location_verified_at timestamptz;

alter table musician_profiles
  add constraint musician_profiles_lat_lng_valid
    check (
      (lat is null and lng is null)
      or (lat between -90 and 90 and lng between -180 and 180)
    ),
  add constraint musician_profiles_verified_address_complete
    check (
      address_verified_at is null
      or (lat is not null and lng is not null and formatted_address is not null)
    );

alter table church_profiles
  add constraint church_profiles_lat_lng_valid
    check (
      (lat is null and lng is null)
      or (lat between -90 and 90 and lng between -180 and 180)
    ),
  add constraint church_profiles_verified_address_complete
    check (
      address_verified_at is null
      or (lat is not null and lng is not null and formatted_address is not null)
    );

alter table service_requests
  add constraint service_requests_location_lat_lng_valid
    check (
      (location_lat is null and location_lng is null)
      or (location_lat between -90 and 90 and location_lng between -180 and 180)
    ),
  add constraint service_requests_location_mode_consistent
    check (
      use_church_location
      or (
        location_address is not null
        and location_city is not null
        and location_state is not null
        and location_lat is not null
        and location_lng is not null
        and location_formatted_address is not null
        and location_verified_at is not null
      )
    );

create index if not exists musician_profiles_available_state_idx
  on musician_profiles (available, state);

create index if not exists unavailability_blocks_profile_date_idx
  on unavailability_blocks (musician_profile_id, start_date, end_date);
