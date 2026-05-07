import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound } from "next/navigation";
import Link from "next/link";

const AV_COLORS = ["#f5d8b8","#d8e4f5","#d8f5dd","#f5d8d8","#ebd8f5","#f5ecd8"];
const AV_TEXT   = ["#8a5a05","#1159af","#13612e","#b82105","#5b1faf","#8a5a05"];

export default async function MusicianProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  type MusicianRow = {
    id: string; profile_id: string; city: string; state: string;
    instruments: string[]; primary_instrument: string; years_experience: number;
    fee_min: number; fee_max: number; bio: string; denomination_tags: string[];
    rating: number; review_count: number; available: boolean;
    profiles: { display_name: string; avatar_url: string | null } | null;
  };
  type ReviewRow = {
    id: string; rating: number; body: string; created_at: string;
    church_profiles: { church_name: string } | null;
  };

  const [{ data: musician }, { data: profile }] = await Promise.all([
    supabase
      .from("musician_profiles")
      .select(`*, profiles(display_name, avatar_url)`)
      .eq("id", id)
      .single() as unknown as Promise<{ data: MusicianRow | null; error: unknown }>,
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!musician) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select(`*, church_profiles(church_name)`)
    .eq("musician_profile_id", id)
    .order("created_at", { ascending: false })
    .limit(5) as unknown as { data: ReviewRow[] | null; error: unknown };

  const isChurch = profile?.role === "church";
  const isOwnProfile = musician.profile_id === user.id;

  const name = musician.profiles?.display_name ?? "Musician";
  const initials = name.split(" ").map((w: string) => w[0]).slice(0, 2).join("");
  const idx = musician.id.charCodeAt(0) % 6;

  const crumbBase = isChurch
    ? [{ label: "Find musicians", href: "/find" }]
    : [{ label: "Browse musicians", href: "/find" }];

  return (
    <>
      <Topbar
        title="Musician profile"
        crumbs={[...crumbBase, { label: name }]}
        right={
          isChurch ? (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href={`/musicians/${id}/invite`} className="btn btn--secondary btn--sm">Invite to request</Link>
            </div>
          ) : undefined
        }
      />
      <div style={{ padding: "32px 32px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "start" }}>
          <div>
            {/* Header */}
            <div style={{ display: "flex", gap: 22, alignItems: "flex-start", paddingBottom: 28, borderBottom: "1px solid var(--sm-border-subtle)", marginBottom: 28 }}>
              <div style={{ width: 80, height: 80, borderRadius: "var(--sm-radius-sm)", background: AV_COLORS[idx], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 24, color: AV_TEXT[idx], flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{name}</h2>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: "var(--sm-fg-3)", fontSize: 15, marginBottom: 12 }}>
                  <span>{musician.city}, {musician.state}</span>
                  <span>· {musician.primary_instrument}</span>
                  {musician.rating > 0 && (
                    <span style={{ color: "var(--sm-accent)" }}>
                      ★ {musician.rating} <span style={{ color: "var(--sm-fg-4)" }}>({musician.review_count} reviews)</span>
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
                  {musician.instruments.map((i: string) => <span key={i} className="chip">{i}</span>)}
                </div>
                {/* Church-only actions */}
                {isChurch && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/messages?musician=${musician.profile_id}`} className="btn btn--primary">
                      Message {name.split(" ")[0]}
                    </Link>
                    <Link href={`/musicians/${id}/invite`} className="btn btn--secondary">
                      Invite to a request
                    </Link>
                  </div>
                )}
                {/* Own profile */}
                {isOwnProfile && (
                  <Link href="/profile" className="btn btn--ghost">Edit your profile</Link>
                )}
              </div>
            </div>

            {/* Bio */}
            {musician.bio && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 14px" }}>About</h3>
                <p style={{ color: "var(--sm-fg-2)", lineHeight: 1.65, margin: 0 }}>{musician.bio}</p>
              </div>
            )}

            {/* Denomination tags */}
            {musician.denomination_tags?.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Comfortable serving</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {musician.denomination_tags.map((t: string) => <span key={t} className="chip chip--outline">{t}</span>)}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 0" }}>What churches have said</h3>
              {reviews && reviews.length > 0 ? reviews.map((r, i) => (
                <div key={r.id} style={{ borderTop: "1px solid var(--sm-border-subtle)", padding: "18px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "var(--sm-radius-sm)", background: AV_COLORS[i % 6], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, color: AV_TEXT[i % 6] }}>
                      {r.church_profiles?.church_name?.[0] ?? "C"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--sm-fg-1)", fontSize: 14 }}>{r.church_profiles?.church_name}</div>
                      <div style={{ color: "var(--sm-fg-4)", fontSize: 12.5 }}>
                        {new Date(r.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </div>
                    </div>
                    <span style={{ marginLeft: "auto", color: "var(--sm-accent)", fontSize: 13 }}>{"★".repeat(r.rating)}</span>
                  </div>
                  <p style={{ fontSize: 14.5, color: "var(--sm-fg-2)", lineHeight: 1.6, margin: 0 }}>{r.body}</p>
                </div>
              )) : (
                <p style={{ color: "var(--sm-fg-3)", fontSize: 14, marginTop: 14 }}>No reviews yet.</p>
              )}
            </div>
          </div>

          {/* Aside */}
          <aside style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22, position: "sticky", top: 90 }}>
            <dl style={{ margin: 0 }}>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Typical fee</dt>
              <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>
                ${musician.fee_min}–${musician.fee_max} <span style={{ fontWeight: 400, color: "var(--sm-fg-3)", fontSize: 13 }}>/ service</span>
              </dd>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Years of experience</dt>
              <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>{musician.years_experience} years</dd>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Availability</dt>
              <dd style={{ margin: isChurch ? "0 0 16px" : 0, fontSize: 14.5, fontWeight: 500, color: musician.available ? "var(--sm-status-success)" : "var(--sm-fg-3)" }}>
                {musician.available ? "Currently available" : "Not available"}
              </dd>
            </dl>
            {isChurch && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--sm-border-subtle)" }}>
                <Link href={`/messages?musician=${musician.profile_id}`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                  Message {name.split(" ")[0]}
                </Link>
                <Link href={`/musicians/${id}/invite`} className="btn btn--secondary" style={{ textAlign: "center", textDecoration: "none" }}>
                  Invite to a request
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
