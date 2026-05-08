import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns a SetupIntent client_secret so the church can save a card via
// Stripe Elements. Creates the underlying Stripe Customer on first call.
export const POST = withJsonErrors(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("id, role, email, display_name").eq("id", user.id).single();
  if (!profile || profile.role !== "church") {
    return NextResponse.json({ error: "Church account required" }, { status: 403 });
  }

  const { data: church } = await supabase
    .from("church_profiles").select("id, church_name").eq("profile_id", user.id).single();
  if (!church) {
    return NextResponse.json({ error: "Complete your church profile first" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("church_profile_id", church.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: profile.email,
      name: church.church_name,
      metadata: {
        church_profile_id: church.id,
        sm_user_id: user.id,
      },
    });
    customerId = customer.id;
    const { error: insertErr } = await admin.from("stripe_customers").insert({
      church_profile_id: church.id,
      stripe_customer_id: customer.id,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  }

  const setupIntent = await stripe().setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  });
});
