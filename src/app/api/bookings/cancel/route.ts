import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withJsonErrors } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cancel a confirmed booking. Either side may cancel before the event.
// The cancel_payment_on_booking_cancel trigger will move any 'scheduled'
// payment to 'cancelled' — no Stripe call is needed since nothing was
// captured (we only charge on the event day).
export const POST = withJsonErrors(async (req: Request) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : null;
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, church_profile_id, musician_profile_id, service_date, cancelled_at")
    .eq("id", bookingId)
    .single();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.cancelled_at) return NextResponse.json({ ok: true, alreadyCancelled: true });

  // Resolve the caller's side via their profile.
  const { data: church } = await supabase
    .from("church_profiles").select("id").eq("profile_id", user.id).maybeSingle();
  const { data: musician } = await supabase
    .from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle();

  let role: "church" | "musician" | null = null;
  if (church && church.id === booking.church_profile_id) role = "church";
  else if (musician && musician.id === booking.musician_profile_id) role = "musician";
  if (!role) return NextResponse.json({ error: "Not a participant in this booking" }, { status: 403 });

  // Don't allow cancelling after the service date has already passed.
  const today = new Date().toISOString().slice(0, 10);
  if (booking.service_date < today) {
    return NextResponse.json({ error: "Service date has already passed; contact support." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: cancelErr } = await admin
    .from("bookings")
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: role,
      cancel_reason: reason,
    })
    .eq("id", bookingId);
  if (cancelErr) return NextResponse.json({ error: cancelErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
});
