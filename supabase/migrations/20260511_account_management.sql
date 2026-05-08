-- Notification preferences + account deletion plumbing.
--
-- Notifications collapse to 3 user-facing toggles (payments / activity /
-- system). Critical alerts (payment captured/failed, card expiring, security
-- events) are not toggleable and are not represented here — the email-send
-- paths simply skip the preference check for those.
--
-- profiles.deleted_at marks soft-deleted accounts. We hard-cascade the
-- profile row on auth.users delete (see initial schema), but until that
-- happens the user can request deletion / data export from the UI; this
-- column lets us hide a soft-deleted user's content while keeping foreign-
-- key integrity for in-flight bookings.

-- ----------------------------------------------------- notification_preferences

create table if not exists notification_preferences (
  profile_id      uuid primary key references profiles on delete cascade,
  payment_emails  boolean not null default true,
  activity_emails boolean not null default true,
  system_emails   boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "Users can read own notification preferences"
  on notification_preferences for select using (profile_id = auth.uid());
create policy "Users can insert own notification preferences"
  on notification_preferences for insert with check (profile_id = auth.uid());
create policy "Users can update own notification preferences"
  on notification_preferences for update using (profile_id = auth.uid());

-- Auto-create a row with defaults the first time we query for a user — done
-- via a trigger on profiles so every new signup gets defaults without an
-- extra app-side write.
create or replace function ensure_notification_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notification_preferences (profile_id)
  values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_notification_preferences on profiles;
create trigger trg_ensure_notification_preferences
after insert on profiles
for each row execute function ensure_notification_preferences();

-- Backfill defaults for existing users.
insert into notification_preferences (profile_id)
select id from profiles
on conflict (profile_id) do nothing;

drop trigger if exists trg_touch_notification_preferences on notification_preferences;
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_touch_notification_preferences before update on notification_preferences
  for each row execute function touch_updated_at();

-- ------------------------------------------------------- profiles.deleted_at

alter table profiles add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx
  on profiles (deleted_at) where deleted_at is null;

-- Hide soft-deleted profiles from public reads. Owners can still see their
-- own row (e.g. to undo deletion within the grace window).
drop policy if exists "Users can read all profiles" on profiles;
create policy "Anyone can read live profiles"
  on profiles for select using (deleted_at is null or auth.uid() = id);
