-- Sunday Musician test accounts.
--
-- Creates 75 musicians and 30 churches for manual QA.
-- Shared password for every seeded auth user: SundayMusicianTest123!
--
-- The seed is idempotent by email. Re-running it updates the seeded profile
-- data instead of creating duplicate accounts.

create extension if not exists pgcrypto with schema extensions;

drop table if exists public._seed_musicians;
create table public._seed_musicians as
with base as (
  select
    n,
    array[
      'Avery','Blake','Casey','Drew','Emery','Finley','Harper','Jordan','Kai','Logan',
      'Morgan','Parker','Quinn','Reese','Riley','Rowan','Sawyer','Taylor','Hayden','Jamie',
      'Alex','Bailey','Cameron','Dakota','Elliot'
    ] as first_names,
    array[
      'Adams','Bennett','Carter','Diaz','Ellis','Foster','Garcia','Hayes','Irwin','Johnson',
      'Kim','Lewis','Miller','Nguyen','Ortiz','Patel','Rivera','Scott','Turner','Walker'
    ] as last_names,
    array[
      'Piano','Keys','Organ','Acoustic Guitar','Electric Guitar','Bass','Drums','Percussion',
      'Vocals','Choir Director','Violin','Cello','Saxophone','Trumpet','Trombone'
    ] as instruments,
    array[
      'Portland','Vancouver','Beaverton','Hillsboro','Gresham','Salem','Eugene','Bend',
      'Seattle','Tacoma','Spokane','Boise','Meridian','Salt Lake City','Provo',
      'Sacramento','Oakland','San Jose','Los Angeles','San Diego'
    ] as cities,
    array[
      'OR','WA','OR','OR','OR','OR','OR','OR',
      'WA','WA','WA','ID','ID','UT','UT',
      'CA','CA','CA','CA','CA'
    ] as states,
    array[
      45.5152,45.6387,45.4871,45.5229,45.5001,44.9429,44.0521,44.0582,
      47.6062,47.2529,47.6588,43.6150,43.6121,40.7608,40.2338,
      38.5816,37.8044,37.3382,34.0522,32.7157
    ]::numeric[] as lats,
    array[
      -122.6784,-122.6615,-122.8037,-122.9898,-122.4302,-123.0351,-123.0868,-121.3153,
      -122.3321,-122.4443,-117.4260,-116.2023,-116.3915,-111.8910,-111.6585,
      -121.4944,-122.2711,-121.8863,-118.2437,-117.1611
    ]::numeric[] as lngs,
    array[
      'Contemporary worship','Gospel','Traditional hymns','Liturgical','Modern hymns',
      'Charismatic','Choir-led','Blended worship'
    ] as traditions
  from generate_series(1, 75) as n
)
select
  n,
  first_names[((n - 1) % array_length(first_names, 1)) + 1] || ' ' ||
    last_names[((n - 1) % array_length(last_names, 1)) + 1] as display_name,
  'seed-musician-' || lpad(n::text, 2, '0') || '@example.test' as email,
  instruments[((n - 1) % array_length(instruments, 1)) + 1] as primary_instrument,
  instruments[(n % array_length(instruments, 1)) + 1] as secondary_instrument,
  cities[((n - 1) % array_length(cities, 1)) + 1] as city,
  states[((n - 1) % array_length(states, 1)) + 1] as state,
  lats[((n - 1) % array_length(lats, 1)) + 1] + (((n % 5) - 2) * 0.012) as lat,
  lngs[((n - 1) % array_length(lngs, 1)) + 1] + (((n % 7) - 3) * 0.012) as lng,
  traditions[((n - 1) % array_length(traditions, 1)) + 1] as tradition,
  75 + ((n % 8) * 25) as fee_min,
  175 + ((n % 10) * 35) as fee_max,
  20 + ((n % 6) * 10) as travel_radius_miles,
  (n % 13 = 0) as is_volunteer,
  round((3.6 + ((n % 15)::numeric / 10.0))::numeric, 1) as rating,
  (n % 18) as review_count
from base;

drop table if exists public._seed_churches;
create table public._seed_churches as
with base as (
  select
    n,
    array[
      'Grace Community Church','River City Church','Hope Fellowship','New Life Chapel','Trinity Church',
      'Redeemer Church','Cedar Hills Church','Crossroads Fellowship','First Covenant Church','City Light Church',
      'The Gathering Church','Resurrection Parish','Bridge Church','Living Water Church','Mountain View Church'
    ] as church_names,
    array[
      'Jeremy Ross','Natalie Brooks','Sam Carter','Lena Kim','Miguel Torres','Rachel Evans',
      'Chris Morgan','Hannah Patel','Marcus Lee','Sarah Bennett'
    ] as contacts,
    array[
      'Portland','Vancouver','Beaverton','Hillsboro','Gresham','Salem','Eugene','Bend',
      'Seattle','Tacoma','Spokane','Boise','Meridian','Salt Lake City','Sacramento'
    ] as cities,
    array[
      'OR','WA','OR','OR','OR','OR','OR','OR',
      'WA','WA','WA','ID','ID','UT','CA'
    ] as states,
    array[
      45.5152,45.6387,45.4871,45.5229,45.5001,44.9429,44.0521,44.0582,
      47.6062,47.2529,47.6588,43.6150,43.6121,40.7608,38.5816
    ]::numeric[] as lats,
    array[
      -122.6784,-122.6615,-122.8037,-122.9898,-122.4302,-123.0351,-123.0868,-121.3153,
      -122.3321,-122.4443,-117.4260,-116.2023,-116.3915,-111.8910,-121.4944
    ]::numeric[] as lngs,
    array[
      'Contemporary worship','Traditional hymns','Gospel choir','Modern liturgical','Blended worship',
      'Acoustic folk worship','High-production modern worship','Organ and choir'
    ] as styles,
    array[
      'Minimal / Intentionally Low production','Basic / Medium production',
      'High Production is implemented on occasion','Every service is highly produced and coordinated'
    ] as production_levels
  from generate_series(1, 30) as n
)
select
  n,
  church_names[((n - 1) % array_length(church_names, 1)) + 1] ||
    case when n > array_length(church_names, 1) then ' ' || (n - array_length(church_names, 1) + 1)::text else '' end as display_name,
  contacts[((n - 1) % array_length(contacts, 1)) + 1] as contact_name,
  'seed-church-' || lpad(n::text, 2, '0') || '@example.test' as email,
  cities[((n - 1) % array_length(cities, 1)) + 1] as city,
  states[((n - 1) % array_length(states, 1)) + 1] as state,
  lats[((n - 1) % array_length(lats, 1)) + 1] + (((n % 4) - 2) * 0.01) as lat,
  lngs[((n - 1) % array_length(lngs, 1)) + 1] + (((n % 6) - 3) * 0.01) as lng,
  125 + ((n % 9) * 75) as capacity,
  1 + (n % 4) as service_count,
  styles[((n - 1) % array_length(styles, 1)) + 1] as musical_style,
  production_levels[((n - 1) % array_length(production_levels, 1)) + 1] as production_level
from base;

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
select
  extensions.gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  m.email,
  extensions.crypt('SundayMusicianTest123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('role', 'musician', 'display_name', m.display_name),
  now(),
  now(),
  '',
  ''
from public._seed_musicians m
where not exists (select 1 from auth.users u where lower(u.email) = lower(m.email));

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
)
select
  extensions.gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  c.email,
  extensions.crypt('SundayMusicianTest123!', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('role', 'church', 'display_name', c.display_name),
  now(),
  now(),
  '',
  ''
from public._seed_churches c
where not exists (select 1 from auth.users u where lower(u.email) = lower(c.email));

insert into profiles (id, role, display_name, email)
select u.id, 'musician', m.display_name, m.email
from public._seed_musicians m
join auth.users u on lower(u.email) = lower(m.email)
where not exists (select 1 from profiles p where p.id = u.id);

insert into profiles (id, role, display_name, email)
select u.id, 'church', c.display_name, c.email
from public._seed_churches c
join auth.users u on lower(u.email) = lower(c.email)
where not exists (select 1 from profiles p where p.id = u.id);

insert into musician_profiles (profile_id, city, state, primary_instrument)
select p.id, m.city, m.state, m.primary_instrument
from public._seed_musicians m
join profiles p on lower(p.email) = lower(m.email)
where not exists (select 1 from musician_profiles mp where mp.profile_id = p.id);

insert into church_profiles (profile_id, church_name, city, state)
select p.id, c.display_name, c.city, c.state
from public._seed_churches c
join profiles p on lower(p.email) = lower(c.email)
where not exists (select 1 from church_profiles cp where cp.profile_id = p.id);

update profiles p
set
  role = 'musician',
  display_name = m.display_name,
  email = m.email,
  deleted_at = null,
  suspended_at = null,
  suspend_reason = null
from public._seed_musicians m
where lower(p.email) = lower(m.email);

update profiles p
set
  role = 'church',
  display_name = c.display_name,
  email = c.email,
  deleted_at = null,
  suspended_at = null,
  suspend_reason = null
from public._seed_churches c
where lower(p.email) = lower(c.email);

update musician_profiles mp
set
  city = m.city,
  state = m.state,
  lat = m.lat,
  lng = m.lng,
  address = (100 + m.n)::text || ' Musician Ave',
  zip = case m.state
    when 'OR' then '9720' || (m.n % 10)::text
    when 'WA' then '9810' || (m.n % 10)::text
    when 'ID' then '8370' || (m.n % 10)::text
    when 'UT' then '8410' || (m.n % 10)::text
    else '9581' || (m.n % 10)::text
  end,
  formatted_address = (100 + m.n)::text || ' Musician Ave, ' || m.city || ', ' || m.state,
  address_verified_at = now(),
  instruments = array[m.primary_instrument, m.secondary_instrument],
  primary_instrument = m.primary_instrument,
  experience_notes = 'Seed musician with church service experience, click-track comfort, and flexible rehearsal availability.',
  gear_notes = case
    when m.primary_instrument in ('Electric Guitar','Bass') then 'Brings amp modeler, DI, charts, and in-ear monitors.'
    when m.primary_instrument in ('Piano','Keys','Organ') then 'Comfortable on house keys, organ, MainStage, and Nashville numbers.'
    when m.primary_instrument in ('Drums','Percussion') then 'Can bring cymbals, snare, percussion, and brushes as needed.'
    else 'Can bring primary instrument, charts, and stage-ready setup.'
  end,
  fee_min = case when m.is_volunteer then 0 else m.fee_min end,
  fee_max = case when m.is_volunteer then 0 else m.fee_max end,
  bio = 'Test profile for ' || m.primary_instrument || '. Serves ' || m.tradition || ' contexts and responds well to clear service plans.',
  denomination_tags = array[m.tradition],
  available = true,
  is_volunteer = m.is_volunteer,
  travel_radius_miles = m.travel_radius_miles,
  rating = m.rating,
  review_count = m.review_count
from public._seed_musicians m
join profiles p on lower(p.email) = lower(m.email)
where mp.profile_id = p.id;

update church_profiles cp
set
  church_name = c.display_name,
  city = c.city,
  state = c.state,
  lat = c.lat,
  lng = c.lng,
  address = (200 + c.n)::text || ' Church St',
  zip = case c.state
    when 'OR' then '9721' || (c.n % 10)::text
    when 'WA' then '9811' || (c.n % 10)::text
    when 'ID' then '8371' || (c.n % 10)::text
    when 'UT' then '8411' || (c.n % 10)::text
    else '9582' || (c.n % 10)::text
  end,
  formatted_address = (200 + c.n)::text || ' Church St, ' || c.city || ', ' || c.state,
  address_verified_at = now(),
  capacity = c.capacity,
  service_count = c.service_count,
  musical_style = c.musical_style,
  production_level = c.production_level
from public._seed_churches c
join profiles p on lower(p.email) = lower(c.email)
where cp.profile_id = p.id;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'church_profiles'
    having count(*) filter (
      where column_name in (
        'contact_name',
        'denomination',
        'musical_approach',
        'music_value',
        'worship_theology',
        'additional_worship_values'
      )
    ) = 6
  ) then
    execute $sql$
      update church_profiles cp
      set
        contact_name = c.contact_name,
        denomination = case c.n % 6
          when 0 then 'Non-denominational'
          when 1 then 'Baptist'
          when 2 then 'Presbyterian'
          when 3 then 'Methodist'
          when 4 then 'Anglican'
          else 'Lutheran'
        end,
        musical_approach = case c.n % 5
          when 0 then 'Vocals Only'
          when 1 then 'Piano / Organ Centric'
          when 2 then 'Acoustic Guitar Centric'
          when 3 then 'Rock Band Configuration'
          else 'Full band including aux instruments, horns, strings, etc'
        end,
        music_value = case c.n % 3
          when 0 then 'Music exists to support the sermon'
          when 1 then 'Musical excellence is something we strive for'
          else 'We''re known for our music'
        end,
        worship_theology = case c.n % 3
          when 0 then 'Conservative'
          when 1 then 'Liturgical'
          else 'Charismatic'
        end,
        additional_worship_values = 'Seed church profile for testing request creation, matching, messaging, and booking flows.'
      from public._seed_churches c
      join profiles p on lower(p.email) = lower(c.email)
      where cp.profile_id = p.id
    $sql$;
  end if;
end $$;

insert into notification_preferences (profile_id)
select p.id
from profiles p
where lower(p.email) like 'seed-musician-%@example.test'
   or lower(p.email) like 'seed-church-%@example.test'
on conflict (profile_id) do nothing;

drop table if exists public._seed_musicians;
drop table if exists public._seed_churches;

select
  (select count(*) from profiles where lower(email) like 'seed-musician-%@example.test') as seeded_musicians,
  (select count(*) from profiles where lower(email) like 'seed-church-%@example.test') as seeded_churches;
