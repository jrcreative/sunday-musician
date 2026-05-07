-- Tighten messaging to be per-request and reduce noise/spam vectors.
--
-- Changes:
--   1. Threads are now per (request, musician) instead of per (church, musician).
--      Each new request the church posts spawns fresh conversations.
--   2. Add per-side unread tracking columns on threads (replaces the
--      single-timestamp localStorage approach in the sidebar).
--   3. Add archive columns (archived_at + archive_reason).
--   4. Trigger: a thread's first message must be a proposal — forces churches
--      to come with concrete terms instead of "hey, you free?" tire-kicking.
--   5. Trigger: cannot send messages on archived threads.
--   6. Trigger: when a request transitions to 'filled' or 'cancelled', archive
--      its threads automatically.

-- ---------------------------------------------------------------- thread shape

-- Drop the old (church, musician) unique. Existing threads with null request_id
-- are dev-state cruft from the prior single-thread-per-pair model — clear them.
delete from threads where request_id is null;

alter table threads
  drop constraint if exists threads_church_profile_id_musician_profile_id_key;

alter table threads alter column request_id set not null;

-- One thread per (request, musician). A church can re-engage the same musician
-- by posting a new request — they just can't ping them at will.
alter table threads
  add constraint threads_request_musician_uniq unique (request_id, musician_profile_id);

-- ----------------------------------------------------- unread + archive columns

alter table threads
  add column last_read_at_church    timestamptz,
  add column last_read_at_musician  timestamptz,
  add column archived_at            timestamptz,
  add column archive_reason         text;  -- 'request_closed' | 'past_service' | 'stale'

create index threads_archived_idx on threads (archived_at);

-- Backfill last_read_at to created_at so existing threads start with zero unread
-- (any pre-existing messages count as already-seen on both sides).
update threads
   set last_read_at_church = coalesce(last_read_at_church, created_at),
       last_read_at_musician = coalesce(last_read_at_musician, created_at);

-- ----------------------------- thread insert policy: either side can initiate
-- (Churches start when inviting a musician to their request. Musicians start
--  when responding to an open request — both legitimate, both anchored to a
--  request_id since that column is now NOT NULL.)

drop policy if exists "Churches can create threads" on threads;
create policy "Participants can create threads" on threads for insert
  with check (
    church_profile_id in (select id from church_profiles where profile_id = auth.uid())
    or musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
  );

-- -------------- trigger: a church's first outreach in a new thread must be a proposal
-- (Forces churches to come with concrete terms — date and fee — instead of
--  low-effort "hey, are you free?" tire-kicking. Musicians initiating in
--  response to an open request are exempt; their interest is the signal.)

create or replace function enforce_first_message_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread threads%rowtype;
  v_sender_is_church boolean;
begin
  if new.kind = 'text' then
    if not exists (select 1 from messages where thread_id = new.thread_id and kind = 'proposal') then
      select * into v_thread from threads where id = new.thread_id;
      v_sender_is_church := exists (
        select 1 from church_profiles
         where id = v_thread.church_profile_id and profile_id = new.sender_profile_id
      );
      if v_sender_is_church then
        raise exception 'First message from a church must be a proposal — start with concrete terms (date and fee).'
          using errcode = 'P0001';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_first_message_proposal
before insert on messages
for each row execute function enforce_first_message_proposal();

-- ------------------------------- trigger: cannot post to archived threads

create or replace function block_archived_thread_messages()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from threads where id = new.thread_id and archived_at is not null) then
    raise exception 'This conversation is archived (request is closed or service date has passed).'
      using errcode = 'P0002';
  end if;
  return new;
end;
$$;

create trigger trg_block_archived_thread_messages
before insert on messages
for each row execute function block_archived_thread_messages();

-- ----------- trigger: archive threads when request status flips to terminal

create or replace function archive_threads_on_request_close()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('filled', 'cancelled')
     and (old.status is null or old.status not in ('filled', 'cancelled')) then
    update threads
       set archived_at = now(), archive_reason = 'request_closed'
     where request_id = new.id and archived_at is null;
  end if;
  return new;
end;
$$;

create trigger trg_archive_threads_on_request_close
after update on service_requests
for each row execute function archive_threads_on_request_close();
