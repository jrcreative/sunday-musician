-- Prevent a musician from being double-booked on the same service date.
-- A partial unique index ignores cancelled bookings (cancelled_at IS NOT NULL),
-- so rescheduled or cancelled gigs don't block future bookings on that date.
CREATE UNIQUE INDEX bookings_musician_date_uniq
  ON bookings (musician_profile_id, service_date)
  WHERE cancelled_at IS NULL;
