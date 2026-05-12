alter table service_requests
  add column if not exists service_end_time time;
