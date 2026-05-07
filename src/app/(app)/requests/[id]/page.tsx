import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { notFound } from "next/navigation";
import Link from "next/link";

const AV_COLORS = ["#f5d8b8","#d8e4f5","#d8f5dd","#f5d8d8","#ebd8f5","#f5ecd8"];
const AV_TEXT   = ["#8a5a05","#1159af","#13612e","#b82105","#5b1faf","#8a5a05"];

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "Negotiating",
  filled: "Confirmed",
  cancelled: "Cancelled",
};
const STATUS_CHIP: Record<string, string> = {
  open: "chip chip--warn",
  in_progress: "chip chip--accent",
  filled: "chip chip--success",
  cancelled: "chip",
};

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  type RequestRow = {
    id: string; church_profile_id: string; title: string; service_type: string;
    service_date: string; service_time: string | null; location: string | null;
    instruments_needed: string[]; rehearsals: string; tech_setup: string[];
    offered_fee: number | null; fee_type: string; setlist_url: string | null;
    notes: string | null; status: string; created_at: string;
    church_profiles: { church_name: string; city: string; state: string } | null;
  };
  type ApplicationRow = {
    id: string; request_id: string; musician_profile_id: string; message: string | null; created_at: string;
    musician_profiles: {
      id: string; profile_id: string; primary_instrument: string; city: string; state: string;
      fee_min: number; fee_max: number;
      profiles: { display_name: string } | null;
    } | null;
  };

  const [{ data: request }, { data: profile }] = await Promise.all([
    supabase
      .from("service_requests")
      .select("*, church_profiles(church_name, city, state)")
      .eq("id", id)
      .single() as unknown as Promise<{ data: RequestRow | null; error: unknown }>,
    supabase.from("profiles").select("role").eq("id", user.id).single(),
  ]);

  if (!request) notFound();

  const isMusician = profile?.role === "musician";
  const d = new Date(request.service_date + "T12:00:00");
  const churchLocation = [request.church_profiles?.city, request.church_profiles?.state].filter(Boolean).join(", ");

  // Church-side: fetch applications
  let applications: ApplicationRow[] | null = null;
  if (!isMusician) {
    const { data } = await supabase
      .from("applications")
      .select("*, musician_profiles(*, profiles(display_name))")
      .eq("request_id", id)
      .order("created_at", { ascending: false }) as unknown as { data: ApplicationRow[] | null; error: unknown };
    applications = data;
  }

  // Musician-side: check if they have a thread for this request
  let threadId: string | null = null;
  if (isMusician) {
    const { data: mp } = await supabase
      .from("musician_profiles").select("id").eq("profile_id", user.id).maybeSingle();
    if (mp) {
      const { data: thread } = await supabase
        .from("threads").select("id")
        .eq("musician_profile_id", mp.id)
        .eq("church_profile_id", request.church_profile_id)
        .maybeSingle();
      threadId = thread?.id ?? null;
    }
  }

  const crumbBase = isMusician
    ? [{ label: "Open Requests", href: "/open-requests" }]
    : [{ label: "Requests", href: "/requests" }];

  return (
    <>
      <Topbar
        title={request.title}
        crumbs={[...crumbBase, { label: request.title }]}
      />
      <div style={{ padding: "32px 32px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "start" }}>

          {/* Main content */}
          <div>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid var(--sm-border-subtle)" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <h2 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{request.title}</h2>
                  <span className={STATUS_CHIP[request.status]}>{STATUS_LABEL[request.status]}</span>
                </div>
                <div style={{ fontSize: 14, color: "var(--sm-fg-3)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  {isMusician && request.church_profiles && (
                    <><span style={{ fontWeight: 500, color: "var(--sm-fg-2)" }}>{request.church_profiles.church_name}</span><span>·</span></>
                  )}
                  <span>{request.service_type}</span>
                  <span>·</span>
                  <span>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                  {request.service_time && <><span>·</span><span>{request.service_time}</span></>}
                  {churchLocation && <><span>·</span><span>{churchLocation}</span></>}
                </div>
              </div>
              {!isMusician && request.status === "open" && (
                <Link href={`/requests/${request.id}/edit`} className="btn btn--ghost btn--sm">Edit request</Link>
              )}
            </div>

            {/* Details grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 40px", marginBottom: 32 }}>
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Instruments needed</h3>
                {request.instruments_needed.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {request.instruments_needed.map((i: string) => <span key={i} className="chip">{i}</span>)}
                  </div>
                ) : (
                  <span style={{ color: "var(--sm-fg-4)", fontSize: 14 }}>Not specified</span>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Rehearsals</h3>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-1)" }}>{request.rehearsals}</p>
              </div>

              {request.tech_setup.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Tech setup</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {request.tech_setup.map((t: string) => <span key={t} className="chip chip--outline">{t}</span>)}
                  </div>
                </div>
              )}

              {request.setlist_url && (
                <div>
                  <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 12px" }}>Setlist</h3>
                  <a href={request.setlist_url} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--sm-accent)", fontSize: 14.5, textDecoration: "underline" }}>
                    View setlist →
                  </a>
                </div>
              )}
            </div>

            {request.notes && (
              <div style={{ marginBottom: 32, padding: "18px 20px", background: "var(--sm-bg-2)", borderRadius: "var(--sm-radius-sm)", borderLeft: "3px solid var(--sm-border-strong)" }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 8px" }}>Notes</h3>
                <p style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-2)", lineHeight: 1.6 }}>{request.notes}</p>
              </div>
            )}

            {/* Church view: applicants */}
            {!isMusician && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: 0 }}>
                    Interested musicians
                    <span style={{ marginLeft: 8, background: "var(--sm-bg-3)", color: "var(--sm-fg-3)", fontSize: 11.5, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>
                      {applications?.length ?? 0}
                    </span>
                  </h3>
                  <Link href="/find" className="btn btn--ghost btn--sm">Browse musicians</Link>
                </div>

                {applications && applications.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {applications.map((app, i) => {
                      const mp = app.musician_profiles as { id: string; profiles: { display_name: string } | null; primary_instrument: string; city: string; state: string; fee_min: number; fee_max: number };
                      const name = mp?.profiles?.display_name ?? "Musician";
                      const idx = i % 6;
                      return (
                        <div key={app.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", background: "var(--sm-bg-1)" }}>
                          <div style={{ width: 44, height: 44, borderRadius: "var(--sm-radius-sm)", background: AV_COLORS[idx], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15, color: AV_TEXT[idx], flexShrink: 0 }}>
                            {name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 15, color: "var(--sm-fg-1)", marginBottom: 2 }}>{name}</div>
                            <div style={{ fontSize: 13, color: "var(--sm-fg-3)" }}>{mp?.primary_instrument} · {mp?.city}, {mp?.state}</div>
                            {app.message && <p style={{ fontSize: 13.5, color: "var(--sm-fg-2)", margin: "8px 0 0", lineHeight: 1.5 }}>{app.message}</p>}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            <Link href={`/musicians/${mp?.id}`} className="btn btn--ghost btn--sm">Profile</Link>
                            <Link href={`/messages?musician=${mp?.id}`} className="btn btn--primary btn--sm">Message</Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "40px 24px", border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-fg-3)" }}>
                    <p style={{ margin: "0 0 16px" }}>No one has applied yet. Invite a musician or wait for matches.</p>
                    <Link href="/find" className="btn btn--secondary">Browse musicians</Link>
                  </div>
                )}
              </div>
            )}

            {/* Musician view: contact CTA */}
            {isMusician && (
              <div style={{ padding: "24px", background: "var(--sm-bg-2)", borderRadius: "var(--sm-radius-sm)", border: "1px solid var(--sm-border-subtle)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--sm-fg-1)", margin: "0 0 8px" }}>
                  Interested in this role?
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--sm-fg-3)", lineHeight: 1.5 }}>
                  Message {request.church_profiles?.church_name ?? "the church"} to introduce yourself and express your interest.
                </p>
                {threadId ? (
                  <Link href={`/messages/${threadId}`} className="btn btn--primary">
                    Continue conversation →
                  </Link>
                ) : (
                  <Link href={`/messages?church_id=${request.church_profile_id}`} className="btn btn--primary">
                    Message {request.church_profiles?.church_name ?? "church"}
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Aside */}
          <aside style={{ border: "1px solid var(--sm-border-subtle)", borderRadius: "var(--sm-radius-sm)", padding: 22, position: "sticky", top: 90 }}>
            <dl style={{ margin: 0 }}>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Offered fee</dt>
              <dd style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: "var(--sm-fg-1)" }}>
                {request.offered_fee != null ? (
                  <>${request.offered_fee} <span style={{ fontWeight: 400, color: "var(--sm-fg-3)", fontSize: 13 }}>/ {request.fee_type.toLowerCase()}</span></>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 400, color: "var(--sm-fg-4)" }}>Not set</span>
                )}
              </dd>
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Date</dt>
              <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>
                {d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </dd>
              {request.service_time && (
                <>
                  <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Time</dt>
                  <dd style={{ margin: "0 0 16px", fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>{request.service_time}</dd>
                </>
              )}
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Status</dt>
              <dd style={{ margin: isMusician ? 0 : "0 0 16px" }}>
                <span className={STATUS_CHIP[request.status]}>{STATUS_LABEL[request.status]}</span>
              </dd>
              {!isMusician && (
                <>
                  <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Applicants</dt>
                  <dd style={{ margin: 0, fontSize: 14.5, color: "var(--sm-fg-1)", fontWeight: 500 }}>
                    {applications?.length ?? 0}
                  </dd>
                </>
              )}
            </dl>
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--sm-border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
              {isMusician ? (
                <>
                  {threadId ? (
                    <Link href={`/messages/${threadId}`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                      View conversation
                    </Link>
                  ) : (
                    <Link href={`/messages?church_id=${request.church_profile_id}`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                      Message church
                    </Link>
                  )}
                  <Link href="/open-requests" className="btn btn--ghost" style={{ textAlign: "center", textDecoration: "none" }}>
                    ← Back to requests
                  </Link>
                </>
              ) : (
                <Link href="/find" className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
                  Find a musician
                </Link>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
