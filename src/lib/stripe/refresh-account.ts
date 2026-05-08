import { stripe } from "./server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AccountStatusRow = {
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
};

// Fetch the live state of a Connect account from Stripe and persist it to
// stripe_accounts. The webhook is the canonical updater, but this gives us a
// self-healing path when the webhook isn't configured yet, hasn't fired, or
// the user wants up-to-the-second status (e.g. on return from onboarding).
//
// Safe to call from a server component render; failures don't throw — they
// return the existing snapshot so the page still renders.
export async function refreshStripeAccountStatus(
  musicianProfileId: string,
  stripeAccountId: string,
  current: AccountStatusRow,
): Promise<AccountStatusRow> {
  try {
    const acct = await stripe().accounts.retrieve(stripeAccountId);
    const next: AccountStatusRow = {
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      details_submitted: !!acct.details_submitted,
    };
    if (
      next.charges_enabled !== current.charges_enabled ||
      next.payouts_enabled !== current.payouts_enabled ||
      next.details_submitted !== current.details_submitted
    ) {
      const admin = createAdminClient();
      await admin
        .from("stripe_accounts")
        .update({
          charges_enabled: next.charges_enabled,
          payouts_enabled: next.payouts_enabled,
          details_submitted: next.details_submitted,
          requirements_due: (acct.requirements?.currently_due ?? []) as string[],
        })
        .eq("musician_profile_id", musicianProfileId);
    }
    return next;
  } catch (e) {
    console.error("[stripe] refreshStripeAccountStatus failed", e);
    return current;
  }
}
