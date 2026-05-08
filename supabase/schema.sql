-- Sunday Musician — Supabase schema
-- Run this in the Supabase SQL editor to initialize the database.

-- Enums
create type user_role as enum ('church', 'musician');
create type request_status as enum ('open', 'in_progress', 'filled', 'cancelled');
create type message_kind as enum ('text', 'proposal');
create type proposal_status as enum ('pending', 'accepted', 'declined', 'countered');
create type email_delivery_status as enum ('sending', 'sent', 'failed', 'skipped');
create type email_delivery_category as enum ('critical', 'payment', 'activity', 'system');

-- Profiles (one per auth.users row)
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  role        user_role not null,
  display_name text not null,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "Users can read all profiles" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

create table email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  category email_delivery_category not null,
  dedupe_key text not null unique,
  recipient_profile_id uuid references profiles on delete set null,
  to_email text not null,
  subject text not null,
  template_id text,
  payload jsonb not null default '{}'::jsonb,
  status email_delivery_status not null default 'sending',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table email_deliveries enable row level security;

-- Musician profiles
create table musician_profiles (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid not null references profiles on delete cascade,
  city                text not null,
  state               text not null,
  lat                 numeric,
  lng                 numeric,
  instruments         text[] not null default '{}',
  primary_instrument  text not null,
  experience_notes    text not null default '',
  gear_notes          text not null default '',
  fee_min             int not null default 0,
  fee_max             int not null default 0,
  bio                 text not null default '',
  denomination_tags   text[] not null default '{}',
  profile_videos      jsonb not null default '[]'::jsonb,
  rating              numeric not null default 0,
  review_count        int not null default 0,
  available           boolean not null default true,
  created_at          timestamptz default now()
);
alter table musician_profiles enable row level security;
create policy "Anyone can read musician profiles" on musician_profiles for select using (true);
create policy "Musicians can update own profile" on musician_profiles for update
  using (profile_id = auth.uid());
create policy "Musicians can insert own profile" on musician_profiles for insert
  with check (profile_id = auth.uid());

-- Church profiles
create table church_profiles (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles on delete cascade,
  church_name      text not null,
  city             text not null,
  state            text not null,
  lat              numeric,
  lng              numeric,
  capacity         int,
  service_count    int,
  musical_style    text,
  production_level text,
  created_at       timestamptz default now()
);
alter table church_profiles enable row level security;
create policy "Anyone can read church profiles" on church_profiles for select using (true);
create policy "Churches can update own profile" on church_profiles for update
  using (profile_id = auth.uid());
create policy "Churches can insert own profile" on church_profiles for insert
  with check (profile_id = auth.uid());

-- Service requests
create table service_requests (
  id                 uuid primary key default gen_random_uuid(),
  church_profile_id  uuid not null references church_profiles on delete cascade,
  title              text not null,
  service_type       text not null,
  service_date       date not null,
  service_time       time,
  location           text,
  instruments_needed text[] not null default '{}',
  rehearsals         text not null,
  tech_setup         text[] not null default '{}',
  offered_fee        numeric,
  fee_type           text not null,
  setlist_url        text,
  notes              text,
  status             request_status not null default 'open',
  created_at         timestamptz default now()
);
alter table service_requests enable row level security;
create policy "Anyone can read open requests" on service_requests for select using (true);
create policy "Churches can insert own requests" on service_requests for insert
  with check (
    church_profile_id in (
      select id from church_profiles where profile_id = auth.uid()
    )
  );
create policy "Churches can update own requests" on service_requests for update
  using (
    church_profile_id in (
      select id from church_profiles where profile_id = auth.uid()
    )
  );

-- Applications (musician expresses interest)
create table applications (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references service_requests on delete cascade,
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  message             text,
  created_at          timestamptz default now(),
  unique (request_id, musician_profile_id)
);
alter table applications enable row level security;
create policy "Churches and applicants can read applications" on applications for select
  using (
    musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
    or request_id in (
      select sr.id from service_requests sr
      join church_profiles cp on cp.id = sr.church_profile_id
      where cp.profile_id = auth.uid()
    )
  );
create policy "Musicians can apply" on applications for insert
  with check (
    musician_profile_id in (
      select id from musician_profiles where profile_id = auth.uid()
    )
  );

-- Threads (one per church+musician+request combo)
create table threads (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid references service_requests on delete set null,
  church_profile_id   uuid not null references church_profiles on delete cascade,
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (church_profile_id, musician_profile_id)
);
alter table threads enable row level security;
create policy "Thread participants can read threads" on threads for select
  using (
    church_profile_id in (select id from church_profiles where profile_id = auth.uid())
    or musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
  );
create policy "Churches can create threads" on threads for insert
  with check (
    church_profile_id in (select id from church_profiles where profile_id = auth.uid())
  );

-- Messages
create table messages (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references threads on delete cascade,
  sender_profile_id uuid not null references profiles on delete cascade,
  kind              message_kind not null default 'text',
  body              text,
  proposal          jsonb,
  proposal_status   proposal_status,
  created_at        timestamptz default now()
);
alter table messages enable row level security;
create policy "Thread participants can read messages" on messages for select
  using (
    thread_id in (
      select t.id from threads t
      where t.church_profile_id in (select id from church_profiles where profile_id = auth.uid())
         or t.musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
    )
  );
create policy "Thread participants can send messages" on messages for insert
  with check (
    sender_profile_id = auth.uid()
    and thread_id in (
      select t.id from threads t
      where t.church_profile_id in (select id from church_profiles where profile_id = auth.uid())
         or t.musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
    )
  );

-- Reviews
create table reviews (
  id                  uuid primary key default gen_random_uuid(),
  musician_profile_id uuid not null references musician_profiles on delete cascade,
  church_profile_id   uuid not null references church_profiles on delete cascade,
  request_id          uuid not null references service_requests on delete cascade,
  rating              int not null check (rating between 1 and 5),
  body                text not null,
  created_at          timestamptz default now(),
  unique (request_id, church_profile_id)
);
alter table reviews enable row level security;
create policy "Anyone can read reviews" on reviews for select using (true);
create policy "Churches can leave reviews" on reviews for insert
  with check (
    church_profile_id in (select id from church_profiles where profile_id = auth.uid())
  );

-- Auto-update musician rating when a review is inserted/updated/deleted
create or replace function update_musician_rating()
returns trigger language plpgsql as $$
begin
  update musician_profiles
  set
    rating = (select round(avg(rating)::numeric, 1) from reviews where musician_profile_id = coalesce(new.musician_profile_id, old.musician_profile_id)),
    review_count = (select count(*) from reviews where musician_profile_id = coalesce(new.musician_profile_id, old.musician_profile_id))
  where id = coalesce(new.musician_profile_id, old.musician_profile_id);
  return new;
end;
$$;

create trigger trg_update_musician_rating
after insert or update or delete on reviews
for each row execute function update_musician_rating();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_display_name text;
begin
  v_role := new.raw_user_meta_data->>'role';
  v_display_name := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, role, display_name, email)
  values (new.id, v_role::user_role, v_display_name, new.email);

  if v_role = 'church' then
    insert into public.church_profiles (profile_id, church_name, city, state)
    values (new.id, v_display_name, '', '');
  elsif v_role = 'musician' then
    insert into public.musician_profiles (profile_id, city, state, primary_instrument)
    values (new.id, '', '', '');
  end if;

  return new;
exception when others then
  raise log 'handle_new_user error: % %', sqlerrm, sqlstate;
  return new;
end;
$$;

create trigger trg_new_user
after insert on auth.users
for each row execute function handle_new_user();

-- Enable realtime for messages
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table threads;
