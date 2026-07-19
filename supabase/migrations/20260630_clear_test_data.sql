-- Launch data reset.
--
-- This migration removes all pre-launch/test data while preserving the
-- schema, RLS policies, functions, triggers, storage bucket, and other
-- structural objects.
--
-- Auth users must be deleted through the Supabase Auth Admin API. Run
-- `npm run auth:delete-users -- --execute` after this migration when you
-- are ready to remove test sign-ins.

begin;

-- Avatar files belong to the test accounts. Keep the bucket and policies.
delete from storage.objects
where bucket_id = 'avatars';

truncate table
  public.admin_actions,
  public.email_deliveries,
  public.booking_disputes,
  public.payments,
  public.reviews,
  public.review_periods,
  public.bookings,
  public.request_match_dismissals,
  public.applications,
  public.messages,
  public.threads,
  public.service_requests,
  public.stripe_accounts,
  public.stripe_customers,
  public.calendar_connections,
  public.unavailability_blocks,
  public.notification_preferences,
  public.musician_profiles,
  public.church_profiles,
  public.profiles
restart identity cascade;

commit;
