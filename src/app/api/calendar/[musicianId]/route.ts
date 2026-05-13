import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + 1);
  return formatDate(d.toISOString().slice(0, 10));
}

export async function GET(req: Request, { params }: { params: Promise<{ musicianId: string }> }) {
  const { musicianId } = await params;

  const admin = createAdminClient();

  // Verify this musician exists
  const { data: mp } = await admin
    .from("musician_profiles")
    .select("id")
    .eq("id", musicianId)
    .maybeSingle();

  if (!mp) {
    return new NextResponse("Not found", { status: 404 });
  }

  type BookingRow = {
    id: string;
    service_date: string;
    service_requests: { title: string } | null;
    church_profiles: { church_name: string } | null;
  };

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, service_date, service_requests(title), church_profiles(church_name)")
    .eq("musician_profile_id", musicianId)
    .is("cancelled_at", null)
    .not("service_date", "is", null) as unknown as { data: BookingRow[] | null };

  const events = (bookings ?? []).map(b => {
    const title = b.service_requests?.title ?? "Service";
    const church = b.church_profiles?.church_name ?? "Church";
    const dtStart = formatDate(b.service_date);
    const dtEnd = addOneDay(b.service_date);
    return [
      "BEGIN:VEVENT",
      `UID:${b.id}@sundaymusician.com`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${title} — ${church}`,
      "DESCRIPTION:Booked via Sunday Musician",
      "END:VEVENT",
    ].join("\r\n");
  });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sunday Musician//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sunday Musician Bookings",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="sunday-musician.ics"',
      "Cache-Control": "no-cache",
    },
  });
}
