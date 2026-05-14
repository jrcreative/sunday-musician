-- Add is_volunteer and travel_radius_miles to musician_profiles.
-- These columns exist in the production database but were never tracked in a
-- migration, so fresh environments built from schema.sql are missing them.
-- Without them, the dashboard's musician_profiles select fails silently,
-- making mp=null and preventing the booking query from running.

alter table musician_profiles
  add column if not exists is_volunteer       boolean not null default false,
  add column if not exists travel_radius_miles int     not null default 0;
