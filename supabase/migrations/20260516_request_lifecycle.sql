-- Request lifecycle: auto-fill on acceptance, release on musician cancel, and
-- block the musician's calendar for booked dates.
--
-- Until now, accepting a proposal created a booking but left
-- service_requests.status='open' (so the request would still show up on the
-- musician open-requests page even though it had a confirmed booking, and
-- other applicants could keep messaging). Cancelling a booking didn't
-- update the request either, so a no-show musician left the church without
-- an obvious "release this back to other musicians" path.
--
-- This migration:
--   1. Extends handle_proposal_accepted to flip the request to 'filled' and
--      drop a 'booking'-source unavailability block on the service date.
--   2. Adds release_request_on_musician_cancel: when a booking is cancelled
--      *by the musician*, the request goes back to 'open' (so the church can
--      offer it to other applicants) and the booking-sourced block is
--      removed. Church cancellations leave the request alone — that flow
--      goes through the dedicated /api/requests/[id]/cancel endpoint which
--      sets status='cancelled' and is a deliberate withdrawal.
--   3. Differentiates archive_reason: 'request_filled' vs 'request_cancelled'
--      so the chat banner can say "filled by another musician" or "the
--      church cancelled this request" instead of one generic message.

-- --------------------------------------------- 'booking' unavailability source

alter type unavailability_source add value if not exists 'booking';

-- ---------------------------- handle_proposal_accepted: also fill the request

create or replace function handle_proposal_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread  threads%rowtype;
  v_request service_requests%rowtype;
  v_fee     int;
  v_fee_type text;
  v_booking_id uuid;
begin
  if new.proposal_status = 'accepted'
     and (old.proposal_status is null or old.proposal_status <> 'accepted') then

    select * into v_thread from threads where id = new.thread_id;
    if v_thread.request_id is null then return new; end if;

    select * into v_request from service_requests where id = v_thread.request_id;
    if not found then return new; end if;

    v_fee := nullif((new.proposal->>'fee'), '')::int;
    v_fee_type := coalesce(new.proposal->>'feeType', v_request.fee_type);

    insert into bookings (request_id, thread_id, church_profile_id, musician_profile_id,
                          service_date, fee, fee_type)
    values (v_request.id, v_thread.id, v_thread.church_profile_id, v_thread.musician_profile_id,
            v_request.service_date, v_fee, v_fee_type)
    on conflict (thread_id) do nothing
    returning id into v_booking_id;

    if v_booking_id is not null then
      insert into review_periods (booking_id, reveal_at)
      values (v_booking_id, (v_request.service_date::timestamptz + interval '7 days'));

      -- Block the musician's calendar for the service date so the request
      -- stops showing up on /open-requests for them and so other churches
      -- browsing availability see them as taken. external_id ties the block
      -- to this booking so the cancel trigger can find and remove it.
      insert into unavailability_blocks
        (musician_profile_id, start_date, end_date, source, external_id, note)
      values
        (v_thread.musician_profile_id, v_request.service_date, v_request.service_date,
         'booking', v_booking_id::text, v_request.title)
      on conflict do nothing;
    end if;

    -- Flip the request to 'filled'. The existing
    -- archive_threads_on_request_close trigger will then archive the *other*
    -- threads on this request (the ones with applicants who didn't get the
    -- gig).
    update service_requests
       set status = 'filled'
     where id = v_request.id
       and status = 'open';
  end if;
  return new;
end;
$$;

-- ----------- release_request_on_musician_cancel: bookings cancellation flow

create or replace function release_request_on_musician_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only act on the moment of cancellation transition.
  if new.cancelled_at is null
     or (old.cancelled_at is not null and old.cancelled_at = new.cancelled_at) then
    return new;
  end if;

  -- Always remove the booking-sourced unavailability block — whoever
  -- cancelled, the musician is no longer committed to that date.
  delete from unavailability_blocks
   where source = 'booking'
     and external_id = new.id::text;

  -- Only release the request back to 'open' if the musician cancelled.
  -- Church cancellations are handled by the church-cancel API, which sets
  -- the request to 'cancelled' deliberately.
  if new.cancelled_by = 'musician' then
    update service_requests
       set status = 'open'
     where id = new.request_id
       and status = 'filled';

    -- Unarchive only the OTHER threads on this request — the threads with
    -- applicants the church can now re-engage. Leave THIS thread archived
    -- so the cancelling musician doesn't drift back into the conversation.
    update threads
       set archived_at = null, archive_reason = null
     where request_id = new.request_id
       and id <> new.thread_id
       and archive_reason = 'request_filled';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_release_request_on_musician_cancel on bookings;
create trigger trg_release_request_on_musician_cancel
after update on bookings
for each row execute function release_request_on_musician_cancel();

-- ----------------------------- archive_reason: differentiate filled vs cancelled

create or replace function archive_threads_on_request_close()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reason text;
begin
  if new.status in ('filled', 'cancelled')
     and (old.status is null or old.status not in ('filled', 'cancelled')) then
    v_reason := case
      when new.status = 'filled'    then 'request_filled'
      when new.status = 'cancelled' then 'request_cancelled'
      else 'request_closed'
    end;
    update threads
       set archived_at = now(), archive_reason = v_reason
     where request_id = new.id and archived_at is null;
  end if;
  return new;
end;
$$;
