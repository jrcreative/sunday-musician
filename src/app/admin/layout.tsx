import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "./AdminSidebar";

// All /admin/* routes pass through this layout. It enforces:
//   - signed-in (redirect to /auth/login)
//   - has profiles.is_admin = true (redirect to /dashboard with a 404
//     posture — we don't want to telegraph that an admin surface exists)
//
// Each page renders its own <AdminTopbar/> so the title and right-rail
// actions can be page-specific.

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email, deleted_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.deleted_at || !profile.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="admin">
      <AdminSidebar actorEmail={profile.email ?? user.email ?? "admin"} />
      <main className="a-main">{children}</main>
    </div>
  );
}
