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
