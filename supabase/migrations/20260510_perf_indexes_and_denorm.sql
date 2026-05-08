-- Performance pass: add hot-path indexes and denormalize thread state.
--
-- Two sets of changes, designed to land together:
--   1. Indexes — covers the queries that actually run on every nav (inbox,
--      sidebar unread, dashboard, find, open requests).
--   2. Denormalization — adds last_message_* and unread_count_* columns to
--      threads, kept current by triggers. Eliminates the "fetch every
--      message in every thread" pattern from /messages and the sidebar.
--
-- Backfill at the bottom rebuilds the new columns from existing data so the
-- migration is safe to apply against populated databases.

-- ───────────────────────────────────────────────────── 1. Hot-path indexes

-- threads — every inbox + sidebar query filters on one of these
create index if not exists threads_musician_profile_idx
  on threads (musician_profile_id);
create index if not exists threads_church_profile_idx
  on threads (church_profile_id);

-- messages — "latest message" and per-thread sweeps
create index if not exists messages_thread_created_idx
  on messages (thread_id, created_at desc);
-- For "messages from someone other than me" filters
create index if not exists messages_sender_idx
  on messages (sender_profile_id);

-- service_requests — open-request browse and dashboard filters
create index if not exists service_requests_status_date_idx
  on service_requests (status, service_date);
create index if not exists service_requests_church_status_idx
  on service_requests (church_profile_id, status, service_date);

-- musician_profiles — Find Musicians orders by rating desc
create index if not exists musician_profiles_rating_idx
  on musician_profiles (rating desc);

-- ─────────────────────────────────── 2. Denormalize thread state

alter table threads
  add column if not exists last_message_at         timestamptz,
  add column if not exists last_message_preview    text,
  add column if not exists last_message_kind       message_kind,
  add column if not exists last_message_sender_id  uuid references profiles on delete set null,
  add column if not exists unread_count_church     int not null default 0,
  add column if not exists unread_count_musician   int not null default 0;

create index if not exists threads_last_message_at_idx
  on threads (last_message_at desc);

-- Trigger: on each new message, update the thread's denormalized columns.
-- Increments the OTHER side's unread_count; the sender's stays at 0 since
-- they obviously already saw what they just sent.
create or replace function update_thread_on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread        threads%rowtype;
  v_preview       text;
  v_sender_is_church  boolean;
begin
  select * into v_thread from threads where id = new.thread_id;
  if not found then return new; end if;

  -- 200-char preview. For proposals we don't have body text — surface the
  -- kind so the inbox can render "Sent a proposal" without joining messages.
  if new.kind = 'proposal' then
    v_preview := null;
  else
    v_preview := left(coalesce(new.body, ''), 200);
  end if;

  v_sender_is_church := exists (
    select 1 from church_profiles
     where id = v_thread.church_profile_id and profile_id = new.sender_profile_id
  );

  if v_sender_is_church then
    update threads set
      last_message_at         = new.created_at,
      last_message_preview    = v_preview,
      last_message_kind       = new.kind,
      last_message_sender_id  = new.sender_profile_id,
      unread_count_musician   = unread_count_musician + 1,
      updated_at              = now()
    where id = new.thread_id;
  else
    update threads set
      last_message_at         = new.created_at,
      last_message_preview    = v_preview,
      last_message_kind       = new.kind,
      last_message_sender_id  = new.sender_profile_id,
      unread_count_church     = unread_count_church + 1,
      updated_at              = now()
    where id = new.thread_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_update_thread_on_message_insert on messages;
create trigger trg_update_thread_on_message_insert
after insert on messages
for each row execute function update_thread_on_message_insert();

-- Trigger: when a side's last_read_at_* is updated to a newer value, reset
-- their unread_count to 0. This is what the thread-page mark-as-read flow
-- triggers via its UPDATE, so unread badges clear without a second query.
create or replace function reset_unread_on_read_at_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_read_at_church is distinct from old.last_read_at_church
     and new.last_read_at_church is not null then
    new.unread_count_church := 0;
  end if;
  if new.last_read_at_musician is distinct from old.last_read_at_musician
     and new.last_read_at_musician is not null then
    new.unread_count_musician := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_unread_on_read_at_update on threads;
create trigger trg_reset_unread_on_read_at_update
before update on threads
for each row execute function reset_unread_on_read_at_update();

-- ───────────────────────────────────────────────────────────── 3. Backfill

-- Latest message per thread
update threads t set
  last_message_at        = m.created_at,
  last_message_preview   = case when m.kind = 'proposal' then null
                                else left(coalesce(m.body, ''), 200) end,
  last_message_kind      = m.kind,
  last_message_sender_id = m.sender_profile_id
from (
  select distinct on (thread_id)
    thread_id, created_at, kind, body, sender_profile_id
  from messages
  order by thread_id, created_at desc
) m
where t.id = m.thread_id;

-- Unread per side: count messages from the OTHER side after my last_read_at.
update threads t set
  unread_count_church = coalesce((
    select count(*) from messages m
    where m.thread_id = t.id
      and m.created_at > coalesce(t.last_read_at_church, '1970-01-01'::timestamptz)
      and not exists (
        select 1 from church_profiles cp
        where cp.id = t.church_profile_id and cp.profile_id = m.sender_profile_id
      )
  ), 0),
  unread_count_musician = coalesce((
    select count(*) from messages m
    where m.thread_id = t.id
      and m.created_at > coalesce(t.last_read_at_musician, '1970-01-01'::timestamptz)
      and not exists (
        select 1 from musician_profiles mp
        where mp.id = t.musician_profile_id and mp.profile_id = m.sender_profile_id
      )
  ), 0);
