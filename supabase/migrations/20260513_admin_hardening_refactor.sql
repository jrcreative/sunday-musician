-- Admin hardening + reporting rollups.
--
-- This migration closes the gaps found in review:
--   * suspended admins are not considered active admins by the SQL helper
--   * admins cannot suspend admin profiles
--   * verify/suspend mutations and audit inserts happen in one DB transaction
--   * admin user rollups are computed by Postgres instead of every page load

-- ----------------------------------------------------- stricter admin helper

create or replace function is_admin(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select p.is_admin
    from profiles p
    where p.id = uid
      and p.deleted_at is null
      and p.suspended_at is null
  ), false);
$$;

-- ----------------------------------------------------- admin user rollup view

create or replace view admin_user_rollups as
with musician_rollups as (
  select
    mp.profile_id,
    mp.id as side_profile_id,
    mp.city,
    mp.state,
    count(pmt.id) filter (where pmt.status = 'captured')::int as bookings,
    coalesce(sum(pmt.musician_amount) filter (where pmt.status = 'captured'), 0)::int as amount_cents
  from musician_profiles mp
  left join payments pmt on pmt.musician_profile_id = mp.id
  group by mp.profile_id, mp.id, mp.city, mp.state
),
church_rollups as (
  select
    cp.profile_id,
    cp.id as side_profile_id,
    cp.church_name,
    cp.city,
    cp.state,
    count(pmt.id) filter (where pmt.status = 'captured')::int as bookings,
    coalesce(sum(pmt.charge_total) filter (where pmt.status = 'captured'), 0)::int as amount_cents
  from church_profiles cp
  left join payments pmt on pmt.church_profile_id = cp.id
  group by cp.profile_id, cp.id, cp.church_name, cp.city, cp.state
)
select
  p.id,
  p.role,
  case
    when p.role = 'church' then coalesce(cr.church_name, p.display_name)
    else p.display_name
  end as name,
  p.email,
  p.is_admin,
  p.verified,
  p.suspended_at,
  p.suspend_reason,
  p.created_at,
  case when p.role = 'church' then cr.side_profile_id else mr.side_profile_id end as side_profile_id,
  coalesce(case when p.role = 'church' then cr.city else mr.city end, '') as city,
  coalesce(case when p.role = 'church' then cr.state else mr.state end, '') as state,
  coalesce(case when p.role = 'church' then cr.bookings else mr.bookings end, 0)::int as bookings,
  coalesce(case when p.role = 'church' then cr.amount_cents else mr.amount_cents end, 0)::int as amount_cents,
  (
    coalesce(case when p.role = 'church' then cr.church_name else p.display_name end, '') || ' ' ||
    coalesce(p.email, '') || ' ' ||
    coalesce(case when p.role = 'church' then cr.city else mr.city end, '') || ' ' ||
    coalesce(case when p.role = 'church' then cr.state else mr.state end, '')
  ) as search_text
from profiles p
left join musician_rollups mr on mr.profile_id = p.id
left join church_rollups cr on cr.profile_id = p.id
where p.deleted_at is null;

-- ----------------------------------------------------- daily payment rollup view

create or replace view admin_daily_payment_rollups as
select
  captured_at::date as day,
  count(*)::int as captured_count,
  coalesce(sum(charge_total), 0)::int as gross_cents,
  coalesce(sum(platform_fee), 0)::int as platform_cents
from payments
where status = 'captured'
  and captured_at is not null
group by captured_at::date;

-- ----------------------------------------------------- transactional admin mutations

create or replace function admin_set_user_verified(
  p_actor_id uuid,
  p_actor_email text,
  p_target_id uuid,
  p_verified boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target profiles%rowtype;
begin
  select * into v_target from profiles where id = p_target_id for update;
  if not found or v_target.deleted_at is not null then
    raise exception 'User not found';
  end if;

  update profiles
     set verified = p_verified
   where id = p_target_id;

  insert into admin_actions (
    actor_id, actor_email, action, target_type, target_id, target_label, level
  ) values (
    p_actor_id,
    p_actor_email,
    case when p_verified then 'verify_user' else 'unverify_user' end,
    'user',
    p_target_id::text,
    v_target.display_name,
    case when p_verified then 'success' else 'info' end
  );
end;
$$;

create or replace function admin_set_user_suspension(
  p_actor_id uuid,
  p_actor_email text,
  p_target_id uuid,
  p_suspended boolean,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target profiles%rowtype;
begin
  select * into v_target from profiles where id = p_target_id for update;
  if not found or v_target.deleted_at is not null then
    raise exception 'User not found';
  end if;
  if v_target.is_admin and p_suspended then
    raise exception 'Admin accounts cannot be suspended';
  end if;

  update profiles
     set suspended_at = case when p_suspended then now() else null end,
         suspend_reason = case when p_suspended then nullif(left(coalesce(p_reason, ''), 500), '') else null end
   where id = p_target_id;

  insert into admin_actions (
    actor_id, actor_email, action, target_type, target_id, target_label, level, metadata
  ) values (
    p_actor_id,
    p_actor_email,
    case when p_suspended then 'suspend_user' else 'unsuspend_user' end,
    'user',
    p_target_id::text,
    v_target.display_name,
    case when p_suspended then 'danger' else 'success' end,
    case
      when p_suspended and nullif(left(coalesce(p_reason, ''), 500), '') is not null
      then jsonb_build_object('reason', left(p_reason, 500))
      else '{}'::jsonb
    end
  );
end;
$$;

revoke all on function admin_set_user_verified(uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function admin_set_user_suspension(uuid, text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function admin_set_user_verified(uuid, text, uuid, boolean) to service_role;
grant execute on function admin_set_user_suspension(uuid, text, uuid, boolean, text) to service_role;
