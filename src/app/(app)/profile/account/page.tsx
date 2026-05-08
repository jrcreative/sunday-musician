import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AccountClient } from "./AccountClient";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // List existing MFA factors so we know whether 2FA is already on.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const totp = factorsData?.totp ?? [];

  return (
    <AccountClient
      initialEmail={user.email ?? ""}
      initialFactors={totp.map(f => ({
        id: f.id,
        status: f.status as "verified" | "unverified",
        friendly_name: f.friendly_name ?? null,
      }))}
    />
  );
}
