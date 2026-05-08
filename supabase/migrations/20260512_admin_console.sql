-- Admin console: is_admin / verified flags + audit log + soft-suspend.
--
-- Auth model: a single profiles.is_admin boolean. A user is an admin if
-- their profile row says so; the API routes under /admin and the
-- /admin/* page guards both check this. Promotion is a manual SQL update
-- by us — there's no in-app self-service for becoming an admin.
--
-- profiles.verified is the "we've checked this account out" badge that
-- the Users console toggles. Distinct from auth-email-confirmed.
--
-- profiles.suspended_at is a soft-suspend marker. Suspended accounts
-- can still sign in (so they can see the suspension reason) but can't
-- send messages, accept proposals, or post requests. We add the
-- enforcement policies in this migration as well so the flag isn't
-- cosmetic. Hard deletion stays under profiles.deleted_at.
--
-- admin_actions is the audit log. Every privileged mutation routed
-- through /api/admin/* writes a row here. Read-only for everyone but
-- service role; admins read via the API.

-- ----------------------------------------------------- profile flags

alter table profiles add column if not exists is_admin     boolean not null default false;
alter table profiles add column if not exists verified     boolean not null default false;
alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspend_reason text;

create index if not exists profiles_is_admin_idx on profiles (id) where is_admin = true;
create index if not exists profiles_suspended_idx on profiles (suspended_at) where suspended_at is not null;

-- ----------------------------------------------------- enforce suspension

-- Suspended accounts can't post requests. We intercept at the policy level
-- so the rule survives any client path.
drop policy if exists "Churches can insert own requests" on service_requests;
create policy "Churches can insert own requests" on service_requests for insert
  with check (
    church_profile_id in (
      select cp.id from church_profiles cp
      join profiles p on p.id = cp.profile_id
      where cp.profile_id = auth.uid()
        and p.suspended_at is null
        and p.deleted_at is null
    )
  );

drop policy if exists "Thread participants can send messages" on messages;
create policy "Thread participants can send messages" on messages for insert
  with check (
    sender_profile_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.suspended_at is null
        and p.deleted_at is null
    )
    and thread_id in (
      select t.id from threads t
      where t.church_profile_id in (select id from church_profiles where profile_id = auth.uid())
         or t.musician_profile_id in (select id from musician_profiles where profile_id = auth.uid())
    )
  );

-- ----------------------------------------------------- admin_actions (audit log)

create table if not exists admin_actions (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null references profiles on delete restrict,
  actor_email     text not null,    -- snapshotted in case the actor's account changes
  action          text not null,    -- e.g. 'send_password_reset', 'suspend_user', 'verify_user', 'unsuspend_user'
  target_type     text,             -- 'user' | 'request' | 'payment' | 'platform'
  target_id       text,             -- profile.id / request.id / payment.id / null
  target_label    text,             -- human-readable target snapshot (e.g. "Hope Community Church")
  level           text not null default 'info',  -- 'info' | 'warn' | 'success' | 'danger'
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on admin_actions (target_type, target_id);
create index if not exists admin_actions_actor_idx on admin_actions (actor_id, created_at desc);

alter table admin_actions enable row level security;

-- Admins can read; nobody else.
create policy "Admins can read audit log"
  on admin_actions for select using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
-- No insert/update/delete policies — service role only via /api/admin/*.

-- ----------------------------------------------------- helper: is the caller an admin?

create or replace function is_admin(uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from profiles where id = uid), false);
$$;
