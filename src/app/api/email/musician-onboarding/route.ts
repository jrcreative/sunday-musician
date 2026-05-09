import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/api/active-user";
import { sendMusicianOnboardingEmail } from "@/lib/email/events/musician-onboarding";

export async function POST() {
  const active = await requireActiveUser();
  if (!active.ok) return active.response;
  if (active.user.role !== "musician") {
    return NextResponse.json({ skipped: true, reason: "not_musician" });
  }

  const result = await sendMusicianOnboardingEmail(active.user.id);
  return NextResponse.json(result);
}
