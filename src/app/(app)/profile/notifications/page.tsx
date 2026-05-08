import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./NotificationsClient";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");

  // Trigger on profiles inserts seeds the row, but for older accounts
  // (and resilience) upsert defaults at read time.
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("payment_emails, activity_emails, system_emails")
    .eq("profile_id", user.id)
    .maybeSingle();
  const initial = prefs ?? { payment_emails: true, activity_emails: true, system_emails: true };

  return <NotificationsClient initial={initial} role={profile.role} />;
}
