import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Save a successfully-confirmed PaymentMethod as the church's default. Called
// by the client after stripe.confirmCardSetup() resolves.
export const POST = withJsonErrors(async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: church } = await supabase
    .from("church_profiles").select("id").eq("profile_id", user.id).single();
  if (!church) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId : null;
  if (!paymentMethodId) {
    return NextResponse.json({ error: "paymentMethodId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("church_profile_id", church.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Stripe customer missing" }, { status: 400 });

  const pm = await stripe().paymentMethods.retrieve(paymentMethodId);
  if (pm.customer && pm.customer !== row.stripe_customer_id) {
    return NextResponse.json({ error: "Payment method does not belong to this customer" }, { status: 403 });
  }
  if (!pm.customer) {
    await stripe().paymentMethods.attach(paymentMethodId, { customer: row.stripe_customer_id });
  }
  await stripe().customers.update(row.stripe_customer_id, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  await admin
    .from("stripe_customers")
    .update({
      default_payment_method: paymentMethodId,
      card_brand: pm.card?.brand ?? null,
      card_last4: pm.card?.last4 ?? null,
      card_exp_month: pm.card?.exp_month ?? null,
      card_exp_year: pm.card?.exp_year ?? null,
    })
    .eq("church_profile_id", church.id);

  return NextResponse.json({ ok: true });
});

// Detach the saved card.
export const DELETE = withJsonErrors(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: church } = await supabase
    .from("church_profiles").select("id").eq("profile_id", user.id).single();
  if (!church) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("stripe_customers")
    .select("default_payment_method")
    .eq("church_profile_id", church.id)
    .maybeSingle();
  if (!row?.default_payment_method) return NextResponse.json({ ok: true });

  try {
    await stripe().paymentMethods.detach(row.default_payment_method);
  } catch {
    // Already detached or gone — proceed to clear our row.
  }

  await admin
    .from("stripe_customers")
    .update({
      default_payment_method: null,
      card_brand: null,
      card_last4: null,
      card_exp_month: null,
      card_exp_year: null,
    })
    .eq("church_profile_id", church.id);

  return NextResponse.json({ ok: true });
});
