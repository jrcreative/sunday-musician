import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { ProfileTabs } from "./ProfileTabs";

// Shared chrome for every profile sub-route. Each tab is its own server
// component (under src/app/(app)/profile/<segment>/page.tsx) so the data it
// needs only loads when visited.
//
// Tab visibility is role-aware: musicians see Payouts, churches see Billing.

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile) redirect("/auth/login");

  const isMusician = profile.role === "musician";
  const tabs = [
    { href: "/profile", label: "Profile" },
    { href: "/profile/bookings", label: "Bookings" },
    isMusician
      ? { href: "/profile/payouts", label: "Payouts" }
      : { href: "/profile/billing", label: "Billing" },
    { href: "/profile/notifications", label: "Notifications" },
    { href: "/profile/account", label: "Account" },
  ];

  return (
    <>
      <Topbar title="My profile" crumbs={[{ label: "My profile" }]} />
      <div className="page page--narrow">
        <ProfileTabs tabs={tabs} />
        {children}
      </div>
    </>
  );
}
