import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { NewRequestForm } from "./NewRequestForm";
import { redirect } from "next/navigation";

export default async function NewRequestPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: churchLocation } = await supabase
    .from("church_profiles")
    .select("address, city, state, zip, lat, lng, formatted_address, address_verified_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  return (
    <>
      <Topbar title="New request" crumbs={[{ label: "Requests", href: "/requests" }, { label: "New" }]} />
      <NewRequestForm churchLocation={churchLocation} />
    </>
  );
}
