import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound, redirect } from "next/navigation";
import { InviteClient } from "./InviteClient";

export default async function InviteMusicianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: musician } = await supabase
    .from("musician_profiles")
    .select("id, profile_id, profiles(display_name)")
    .eq("id", id)
    .single() as unknown as {
      data: { id: string; profile_id: string; profiles: { display_name: string } | null } | null;
      error: unknown;
    };
  if (!musician) notFound();

  const { data: cp } = await supabase
    .from("church_profiles")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!cp) redirect("/profile");

  const { data: requests } = await supabase
    .from("service_requests")
    .select("id, title, service_date, service_type, offered_fee, fee_type, notes")
    .eq("church_profile_id", cp.id)
    .eq("status", "open")
    .order("service_date", { ascending: true });

  const musicianName = musician.profiles?.display_name ?? "Musician";

  return (
    <>
      <Topbar
        title={`Invite ${musicianName}`}
        crumbs={[
          { label: "Find musicians", href: "/find" },
          { label: musicianName, href: `/musicians/${id}` },
          { label: "Invite to request" },
        ]}
      />
      <InviteClient
        musicianProfileId={id}
        churchProfileId={cp.id}
        currentUserId={user.id}
        musicianName={musicianName}
        requests={requests ?? []}
      />
    </>
  );
}
