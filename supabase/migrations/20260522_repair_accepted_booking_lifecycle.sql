-- Repair accepted proposals that did not get a bookings row and make the
-- acceptance trigger tolerant of decimal fee strings.

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

    v_fee := case
      when coalesce(new.proposal->>'fee', '') ~ '^[0-9]+(\.[0-9]+)?$'
        then round((new.proposal->>'fee')::numeric)::int
      else null
    end;
    v_fee_type := coalesce(new.proposal->>'feeType', v_request.fee_type);

    insert into bookings (request_id, thread_id, church_profile_id, musician_profile_id,
                          service_date, fee, fee_type)
    values (v_request.id, v_thread.id, v_thread.church_profile_id, v_thread.musician_profile_id,
            v_request.service_date, v_fee, v_fee_type)
    on conflict (thread_id) do update
      set request_id = excluded.request_id,
          church_profile_id = excluded.church_profile_id,
          musician_profile_id = excluded.musician_profile_id,
          service_date = excluded.service_date,
          fee = coalesce(bookings.fee, excluded.fee),
          fee_type = coalesce(bookings.fee_type, excluded.fee_type)
    returning id into v_booking_id;

    if v_booking_id is not null then
      insert into review_periods (booking_id, reveal_at)
      values (v_booking_id, (v_request.service_date::timestamptz + interval '7 days'))
      on conflict (booking_id) do nothing;

      insert into unavailability_blocks
        (musician_profile_id, start_date, end_date, source, external_id, note)
      values
        (v_thread.musician_profile_id, v_request.service_date, v_request.service_date,
         'booking', v_booking_id::text, v_request.title)
      on conflict do nothing;
    end if;

    update service_requests
       set status = 'filled'
     where id = v_request.id
       and status = 'open';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_proposal_accepted on messages;
create trigger trg_handle_proposal_accepted
after update on messages
for each row execute function handle_proposal_accepted();

insert into bookings (
  request_id,
  thread_id,
  church_profile_id,
  musician_profile_id,
  service_date,
  fee,
  fee_type
)
select
  sr.id,
  t.id,
  t.church_profile_id,
  t.musician_profile_id,
  sr.service_date,
  case
    when coalesce(m.proposal->>'fee', '') ~ '^[0-9]+(\.[0-9]+)?$'
      then round((m.proposal->>'fee')::numeric)::int
    else null
  end,
  coalesce(m.proposal->>'feeType', sr.fee_type)
from messages m
join threads t on t.id = m.thread_id
join service_requests sr on sr.id = t.request_id
where m.kind = 'proposal'
  and m.proposal_status = 'accepted'
on conflict (thread_id) do nothing;

insert into review_periods (booking_id, reveal_at)
select b.id, (b.service_date::timestamptz + interval '7 days')
from bookings b
where not exists (
  select 1
  from review_periods rp
  where rp.booking_id = b.id
)
on conflict (booking_id) do nothing;

insert into unavailability_blocks
  (musician_profile_id, start_date, end_date, source, external_id, note)
select
  b.musician_profile_id,
  b.service_date,
  b.service_date,
  'booking',
  b.id::text,
  sr.title
from bookings b
join service_requests sr on sr.id = b.request_id
where b.cancelled_at is null
  and not exists (
    select 1
    from unavailability_blocks ub
    where ub.musician_profile_id = b.musician_profile_id
      and ub.source = 'booking'
      and ub.external_id = b.id::text
  )
on conflict do nothing;

update service_requests sr
   set status = 'filled'
 where sr.status = 'open'
   and exists (
     select 1
     from bookings b
     where b.request_id = sr.id
       and b.cancelled_at is null
   );
