-- Prevent a musician from being double-booked on the same service date.
-- A partial unique index ignores cancelled bookings (cancelled_at IS NOT NULL),
-- so rescheduled or cancelled gigs don't block future bookings on that date.

do $$
declare
  v_duplicate text;
begin
  select string_agg(
    musician_profile_id || ' on ' || service_date || ' (' || booking_ids || ')',
    '; '
  )
  into v_duplicate
  from (
    select
      musician_profile_id,
      service_date,
      string_agg(id::text, ', ' order by accepted_at desc, created_at desc) as booking_ids
    from bookings
    where cancelled_at is null
    group by musician_profile_id, service_date
    having count(*) > 1
  ) duplicates;

  if v_duplicate is not null then
    raise exception
      'Cannot create bookings_musician_date_uniq while duplicate active bookings exist: %',
      v_duplicate
      using errcode = 'unique_violation';
  end if;
end $$;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_musician_date_uniq
  ON bookings (musician_profile_id, service_date)
  WHERE cancelled_at IS NULL;
