"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const SERVICE_TYPES = [
  "Sunday morning",
  "Sunday evening",
  "Wednesday service",
  "Special service",
  "Funeral",
  "Wedding",
  "Conference / retreat",
  "Christmas / Easter",
];

const INSTRUMENTS = [
  "Worship leader",
  "Acoustic guitar",
  "Electric guitar",
  "Bass",
  "Drums",
  "Piano/Keys",
  "Vocals",
  "Violin",
  "Cello",
  "Saxophone",
];

const TECH_SETUP = [
  "In-ear monitors",
  "Wedge monitors",
  "Click track",
  "Charts provided",
  "House piano/keys",
  "House drum kit",
  "House bass amp",
  "Direct boxes available",
];

const STEPS = ["Service details", "Musician needs", "Logistics & fee", "Review"];

type FormData = {
  title: string;
  serviceType: string;
  date: string;
  time: string;
  instruments: string[];
  rehearsals: string;
  setlistUrl: string;
  techSetup: string[];
  fee: string;
  feeType: string;
  notes: string;
};

type ExistingRequest = {
  id: string;
  title: string;
  service_type: string;
  service_date: string;
  service_time: string | null;
  instruments_needed: string[];
  rehearsals: string;
  setlist_url: string | null;
  tech_setup: string[];
  offered_fee: number | null;
  fee_type: string;
  notes: string | null;
};

export function NewRequestForm({
  prefilledMusician,
  existingRequest,
}: {
  prefilledMusician?: string;
  existingRequest?: ExistingRequest;
}) {
  const router = useRouter();
  const isEditing = !!existingRequest;
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<FormData>(() => {
    if (existingRequest) {
      return {
        title: existingRequest.title,
        serviceType: existingRequest.service_type,
        date: existingRequest.service_date,
        time: existingRequest.service_time ?? "10:00",
        instruments: existingRequest.instruments_needed,
        rehearsals: existingRequest.rehearsals,
        setlistUrl: existingRequest.setlist_url ?? "",
        techSetup: existingRequest.tech_setup,
        fee: existingRequest.offered_fee != null ? String(existingRequest.offered_fee) : "",
        feeType: existingRequest.fee_type,
        notes: existingRequest.notes ?? "",
      };
    }
    return {
      title: "",
      serviceType: "Sunday morning",
      date: "",
      time: "10:00",
      instruments: [],
      rehearsals: "None — show up Sunday morning",
      setlistUrl: "",
      techSetup: [],
      fee: "",
      feeType: "Per service",
      notes: "",
    };
  });

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setData(d => ({ ...d, [k]: v }));
  }

  function toggleArr(k: "instruments" | "techSetup", v: string) {
    setData(d => ({
      ...d,
      [k]: d[k].includes(v) ? d[k].filter((x: string) => x !== v) : [...d[k], v],
    }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fields = {
        title: data.title || "Untitled request",
        service_type: data.serviceType,
        service_date: data.date,
        service_time: data.time || null,
        location: null,
        instruments_needed: data.instruments,
        rehearsals: data.rehearsals,
        setlist_url: data.setlistUrl || null,
        tech_setup: data.techSetup,
        offered_fee: data.fee ? parseFloat(data.fee) : null,
        fee_type: data.feeType,
        notes: data.notes || null,
      };

      if (isEditing && existingRequest) {
        const { error: updateErr } = await supabase
          .from("service_requests")
          .update(fields)
          .eq("id", existingRequest.id);
        if (updateErr) throw updateErr;
        router.push(`/requests/${existingRequest.id}`);
      } else {
        const { data: churchProfile, error: cpErr } = await supabase
          .from("church_profiles").select("id").eq("profile_id", user.id).single();
        if (cpErr || !churchProfile) throw new Error("Church profile not found");

        const { error: insertErr } = await supabase.from("service_requests").insert({
          ...fields,
          church_profile_id: churchProfile.id,
          status: "open",
        });
        if (insertErr) throw insertErr;
        router.push("/requests");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "32px 32px 80px", maxWidth: 760, margin: "0 auto" }}>
      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 600,
                background: i < step ? "var(--sm-accent)" : i === step ? "var(--sm-accent)" : "var(--sm-bg-3)",
                color: i <= step ? "#fff" : "var(--sm-fg-3)",
                flexShrink: 0,
              }}>
                {i < step ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                ) : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: i === step ? 600 : 400, color: i === step ? "var(--sm-fg-1)" : "var(--sm-fg-3)", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 1, background: i < step ? "var(--sm-accent)" : "var(--sm-border-subtle)", flex: 1, margin: "0 8px", marginBottom: 22 }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Service details */}
      {step === 0 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Tell us about the service</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>This is what musicians will see first. Be plain — what&apos;s the service, when is it, where is it.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">Request title</label>
              <input className="input" placeholder="e.g. Sunday morning — pianist needed"
                value={data.title} onChange={e => set("title", e.target.value)} />
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5 }}>A short headline so musicians can scan their inbox.</div>
            </div>
            <div>
              <label className="label">Service type</label>
              <select className="select" value={data.serviceType} onChange={e => set("serviceType", e.target.value)}>
                {SERVICE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={data.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="label">Service start time</label>
              <input type="time" className="input" value={data.time} onChange={e => set("time", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Musician needs */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Who do you need?</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>Pick everything you need filled. You can ask one musician to cover multiple roles.</p>
          <label className="label">Instruments / roles needed</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 24 }}>
            {INSTRUMENTS.map(i => (
              <button
                key={i}
                type="button"
                onClick={() => toggleArr("instruments", i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: `1px solid ${data.instruments.includes(i) ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)",
                  background: data.instruments.includes(i) ? "color-mix(in srgb, var(--sm-accent) 8%, transparent)" : "var(--sm-bg-1)",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--sm-fg-1)",
                  textAlign: "left",
                  transition: "border-color var(--sm-dur-base) var(--sm-ease)",
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: `1.5px solid ${data.instruments.includes(i) ? "var(--sm-accent)" : "var(--sm-border)"}`,
                  background: data.instruments.includes(i) ? "var(--sm-accent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all var(--sm-dur-base) var(--sm-ease)",
                }}>
                  {data.instruments.includes(i) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  )}
                </span>
                {i}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
            <div>
              <label className="label">Rehearsals</label>
              <select className="select" value={data.rehearsals} onChange={e => set("rehearsals", e.target.value)}>
                <option>None — show up Sunday morning</option>
                <option>1 (Saturday evening)</option>
                <option>1 (weekday evening)</option>
                <option>2 — full team practice + run-through</option>
              </select>
            </div>
            <div>
              <label className="label">Setlist / repertoire link</label>
              <input className="input" placeholder="Planning Center, shared doc, or Spotify playlist"
                value={data.setlistUrl} onChange={e => set("setlistUrl", e.target.value)} />
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5 }}>Optional. Helps musicians know if they&apos;re a fit.</div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Logistics & fee */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Logistics &amp; fee</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>What&apos;s the tech setup like, and what are you offering. Fees can be negotiated in the message thread.</p>
          <label className="label">Tech setup at the venue</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, marginBottom: 24 }}>
            {TECH_SETUP.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => toggleArr("techSetup", t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: `1px solid ${data.techSetup.includes(t) ? "var(--sm-accent)" : "var(--sm-border-subtle)"}`,
                  borderRadius: "var(--sm-radius-sm)",
                  background: data.techSetup.includes(t) ? "color-mix(in srgb, var(--sm-accent) 8%, transparent)" : "var(--sm-bg-1)",
                  cursor: "pointer",
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--sm-fg-1)",
                  textAlign: "left",
                  transition: "border-color var(--sm-dur-base) var(--sm-ease)",
                }}
              >
                <span style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: `1.5px solid ${data.techSetup.includes(t) ? "var(--sm-accent)" : "var(--sm-border)"}`,
                  background: data.techSetup.includes(t) ? "var(--sm-accent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all var(--sm-dur-base) var(--sm-ease)",
                }}>
                  {data.techSetup.includes(t) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  )}
                </span>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
            <div>
              <label className="label">Offered fee</label>
              <div style={{ display: "flex" }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 12px",
                  border: "1px solid var(--sm-border)",
                  borderRight: "none",
                  borderRadius: "3px 0 0 3px",
                  color: "var(--sm-fg-3)",
                  background: "var(--sm-bg-2)",
                  fontSize: 14,
                }}>$</span>
                <input className="input" style={{ borderRadius: "0 3px 3px 0" }}
                  placeholder="200" value={data.fee} onChange={e => set("fee", e.target.value)} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--sm-fg-4)", marginTop: 5 }}>Treat this as a starting offer. Musicians can counter.</div>
            </div>
            <div>
              <label className="label">Fee type</label>
              <select className="select" value={data.feeType} onChange={e => set("feeType", e.target.value)}>
                <option>Per service</option>
                <option>Per service (incl. rehearsal)</option>
                <option>Per hour</option>
                <option>Honorarium</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="label">Notes / vibe (optional)</label>
              <textarea className="textarea" rows={4}
                placeholder="Anything else worth knowing — congregation size, vibe of the service, songs you definitely want, denominational context, accessibility, parking, etc."
                value={data.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & post */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.01em" }}>Looks good?</h2>
          <p style={{ fontSize: 16, color: "var(--sm-fg-3)", margin: "0 0 28px" }}>You can edit any section before posting. Once you post, musicians who match will see this in their feed.</p>

          {[
            {
              heading: "Service",
              onEdit: () => setStep(0),
              rows: [
                ["Title", data.title || <em style={{ color: "var(--sm-fg-4)" }}>untitled</em>],
                ["Type", data.serviceType],
                ["Date & time", data.date ? `${data.date} at ${data.time}` : <em style={{ color: "var(--sm-fg-4)" }}>not set</em>],
              ],
            },
            {
              heading: "Musician needs",
              onEdit: () => setStep(1),
              rows: [
                ["Instruments", data.instruments.length ? data.instruments.join(", ") : <em style={{ color: "var(--sm-fg-4)" }}>none selected</em>],
                ["Rehearsals", data.rehearsals],
                ["Setlist", data.setlistUrl || <em style={{ color: "var(--sm-fg-4)" }}>not provided</em>],
              ],
            },
            {
              heading: "Logistics",
              onEdit: () => setStep(2),
              rows: [
                ["Tech", data.techSetup.length ? data.techSetup.join(", ") : <em style={{ color: "var(--sm-fg-4)" }}>none</em>],
                ["Fee", data.fee ? `$${data.fee} · ${data.feeType}` : <em style={{ color: "var(--sm-fg-4)" }}>not set</em>],
                ["Notes", data.notes || <em style={{ color: "var(--sm-fg-4)" }}>none</em>],
              ],
            },
          ].map(block => (
            <div key={block.heading} style={{
              border: "1px solid var(--sm-border-subtle)",
              borderRadius: "var(--sm-radius-sm)",
              padding: "18px 20px",
              marginBottom: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--sm-fg-3)" }}>
                  {block.heading}
                </h4>
                <button
                  type="button"
                  onClick={block.onEdit}
                  className="btn btn--ghost btn--sm"
                >
                  Edit
                </button>
              </div>
              <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "140px 1fr", gap: "8px 16px" }}>
                {block.rows.map(([label, value], i) => (
                  <Fragment key={i}>
                    <dt style={{ fontSize: 13, color: "var(--sm-fg-3)", fontWeight: 500 }}>{label}</dt>
                    <dd style={{ margin: 0, fontSize: 13.5, color: "var(--sm-fg-1)" }}>{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          ))}

          {error && (
            <div style={{ padding: "12px 16px", background: "color-mix(in srgb, var(--sm-status-error) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--sm-status-error) 30%, transparent)", borderRadius: "var(--sm-radius-sm)", color: "var(--sm-status-error)", fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--sm-border-subtle)" }}>
        {step === 0 ? (
          <button type="button" className="btn btn--ghost" onClick={() => router.push(isEditing ? `/requests/${existingRequest!.id}` : "/requests")}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn btn--ghost" onClick={() => setStep(s => s - 1)}>
            ← Back
          </button>
        )}
        {step < 3 ? (
          <button type="button" className="btn btn--primary" onClick={() => setStep(s => s + 1)}>
            Continue →
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleSubmit}
            disabled={submitting}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? (isEditing ? "Saving…" : "Posting…") : (isEditing ? "Save changes" : "Post request")}
          </button>
        )}
      </div>
    </div>
  );
}
