import { createClient, getActiveImpersonation } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const impersonation = await getActiveImpersonation();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <AppShell profile={profile} userId={user.id} impersonation={impersonation}>
      {children}
    </AppShell>
  );
}
