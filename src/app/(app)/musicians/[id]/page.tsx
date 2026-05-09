import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/shell/Topbar";
import { Avatar } from "@/components/Avatar";
import { notFound } from "next/navigation";
import Link from "next/link";

type VideoEntry = { url: string; title: string; description: string };

function youtubeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");
    let videoId: string | null = null;

    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v");
      if (url.pathname.startsWith("/embed/")) videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
      if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function profileVideosFromRow(profileVideos: unknown, youtubeLinks: string[]): VideoEntry[] {
  if (Array.isArray(profileVideos)) {
    const videos = profileVideos
      .map(video => {
        if (!video || typeof video !== "object" || Array.isArray(video)) return null;
        const entry = video as Record<string, unknown>;
        return {
          url: typeof entry.url === "string" ? entry.url : "",
          title: typeof entry.title === "string" ? entry.title : "",
          description: typeof entry.description === "string" ? entry.description : "",
        };
      })
      .filter((video): video is VideoEntry => !!video && video.url.trim().length > 0);
    if (videos.length > 0) return videos;
  }

  return youtubeLinks
    .filter(link => link.trim().length > 0)
    .map(url => ({ url, title: "", description: "" }));
}

export default async function MusicianProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  type MusicianRow = {
    id: string; profile_id: string; city: string; state: string;
    instruments: string[]; primary_instrument: string;
    fee_min: number; fee_max: number; bio: string; denomination_tags: string[];
    experience_notes: string; gear_notes: string; youtube_links: string[]; profile_videos: unknown;
    rating: number; review_count: number; available: boolean;
    profiles: { display_name: string; avatar_url: string | null } | null;
  };
  type ReviewRow = {
    id: string; rating: number; body: string; submitted_at: string;
    church_name: string | null;
    church_avatar: string | null;
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

  // Released reviews about this musician — written by churches, on periods that
  // have been released. Two-step query to keep filter syntax simple.
  const { data: releasedPeriods } = await supabase
    .from("review_periods")
    .select("id, bookings!inner(church_profile_id, musician_profile_id, church_profiles(church_name, profiles(avatar_url)))")
    .eq("bookings.musician_profile_id", id)
    .not("released_at", "is", null) as unknown as { data: Array<{
      id: string;
      bookings: {
        church_profile_id: string;
        church_profiles: { church_name: string; profiles: { avatar_url: string | null } | null } | null;
      } | null;
    }> | null };

  const periodIds = (releasedPeriods ?? []).map(p => p.id);
  const churchByPeriod = new Map<string, { name: string | null; avatar: string | null }>();
  for (const p of releasedPeriods ?? []) {
    churchByPeriod.set(p.id, {
      name: p.bookings?.church_profiles?.church_name ?? null,
      avatar: p.bookings?.church_profiles?.profiles?.avatar_url ?? null,
    });
  }

  const { data: rawReviews } = periodIds.length > 0
    ? await supabase
        .from("reviews")
        .select("id, period_id, rating, body, submitted_at")
        .in("period_id", periodIds)
        .eq("reviewer_role", "church")
        .order("submitted_at", { ascending: false })
        .limit(5)
    : { data: [] as { id: string; period_id: string; rating: number; body: string; submitted_at: string }[] };

  const reviews: ReviewRow[] = (rawReviews ?? []).map(r => {
    const ch = churchByPeriod.get(r.period_id);
    return {
      id: r.id,
      rating: r.rating,
      body: r.body,
      submitted_at: r.submitted_at,
      church_name: ch?.name ?? null,
      church_avatar: ch?.avatar ?? null,
    };
  });

  const isChurch = profile?.role === "church";
  const isOwnProfile = musician.profile_id === user.id;

  const name = musician.profiles?.display_name ?? "Musician";
  const idx = musician.id.charCodeAt(0) % 6;
  const videoEmbeds = profileVideosFromRow(musician.profile_videos, musician.youtube_links ?? [])
    .map(video => ({ ...video, embedUrl: youtubeEmbedUrl(video.url) }))
    .filter(video => video.embedUrl);

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
      <div className="page">
        <div className="sm-split sm-split--profile" style={{ gap: 32 }}>
          <div>
            {/* Header */}
            <div style={{ display: "flex", gap: 22, alignItems: "flex-start", paddingBottom: 28, borderBottom: "1px solid var(--sm-border-subtle)", marginBottom: 28 }}>
              <Avatar src={musician.profiles?.avatar_url} name={name} size={80} colorIndex={idx} fontSize={24} />
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
                {/* Church-only actions — outreach is always anchored to a specific request */}
                {isChurch && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link href={`/musicians/${id}/invite`} className="btn btn--primary">
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
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 10px" }}>Denominations / traditions</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {musician.denomination_tags.map((t: string) => <span key={t} className="chip chip--outline">{t}</span>)}
                </div>
              </div>
            )}

            {musician.experience_notes?.trim() && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 14px" }}>Experience</h3>
                <p style={{ color: "var(--sm-fg-2)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-line" }}>{musician.experience_notes}</p>
              </div>
            )}

            {musician.gear_notes?.trim() && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 14px" }}>Gear / setup</h3>
                <p style={{ color: "var(--sm-fg-2)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-line" }}>{musician.gear_notes}</p>
              </div>
            )}

            {videoEmbeds.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 14px" }}>Video</h3>
                <div style={{ display: "grid", gap: 14 }}>
                  {videoEmbeds.map(video => (
                    <div key={video.url} style={{ display: "grid", gap: 8 }}>
                      <iframe
                        src={video.embedUrl ?? undefined}
                        title={video.title || `${name} video`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        style={{
                          width: "100%",
                          aspectRatio: "16 / 9",
                          border: "0",
                          borderRadius: "var(--sm-radius-sm)",
                          background: "var(--sm-bg-3)",
                        }}
                      />
                      {(video.title || video.description) && (
                        <div>
                          {video.title && (
                            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--sm-fg-1)", marginBottom: video.description ? 3 : 0 }}>
                              {video.title}
                            </div>
                          )}
                          {video.description && (
                            <p style={{ fontSize: 13.5, color: "var(--sm-fg-3)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-line" }}>
                              {video.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--sm-fg-3)", margin: "0 0 0" }}>What churches have said</h3>
              {reviews && reviews.length > 0 ? reviews.map((r, i) => (
                <div key={r.id} style={{ borderTop: "1px solid var(--sm-border-subtle)", padding: "18px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <Avatar src={r.church_avatar} name={r.church_name ?? "Church"} size={32} colorIndex={i} fontSize={12} />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--sm-fg-1)", fontSize: 14 }}>{r.church_name}</div>
                      <div style={{ color: "var(--sm-fg-4)", fontSize: 12.5 }}>
                        {new Date(r.submitted_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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
              <dt style={{ fontSize: 12, color: "var(--sm-fg-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600, marginBottom: 4 }}>Availability</dt>
              <dd style={{ margin: isChurch ? "0 0 16px" : 0, fontSize: 14.5, fontWeight: 500, color: musician.available ? "var(--sm-status-success)" : "var(--sm-fg-3)" }}>
                {musician.available ? "Currently available" : "Not available"}
              </dd>
            </dl>
            {isChurch && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--sm-border-subtle)" }}>
                <Link href={`/musicians/${id}/invite`} className="btn btn--primary" style={{ textAlign: "center", textDecoration: "none" }}>
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
