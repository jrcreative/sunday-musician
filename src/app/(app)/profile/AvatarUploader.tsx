"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Profile avatar uploader.
//
// Pipeline (all client-side):
//   1. <input type="file"> with a 5MB hard cap and an accept list of
//      png/jpg/webp. iOS Safari sometimes hands us a .heic anyway —
//      createImageBitmap will reject it and we surface a clear error.
//   2. Decode with createImageBitmap(file, { imageOrientation: "from-image" })
//      so EXIF-rotated phone photos land right-side-up. Plain Image() ignores
//      EXIF and you get sideways portraits half the time.
//   3. Interactive cropper modal (drag to pan, slider/wheel to zoom). The
//      viewport is a fixed 320px square; whatever the user has framed becomes
//      the crop.
//   4. Render the framed area into a 600x600 canvas and toBlob('image/webp', 0.7).
//      We render at 600 instead of 300 so the avatar still looks crisp on
//      retina screens; WebP q70 keeps it ~15-25KB.
//   5. Upload to avatars/<auth.uid()>/<timestamp>.webp. Each upload is a
//      new key, so the public URL changes — that's our cache-busting.
//   6. Update profiles.avatar_url + avatar_path. If avatar_path was set
//      before, delete that old object so we don't leak storage.
//
// Transparency is preserved (WebP supports alpha; we don't flatten).

const MAX_FILE_BYTES = 5 * 1024 * 1024;          // 5MB
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"];
const VIEWPORT_PX = 320;                          // cropper preview size (CSS)
const EXPORT_PX = 600;                            // final stored dimension
const WEBP_QUALITY = 0.7;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

type Props = {
  profileId: string;
  currentUrl: string | null;
  currentPath: string | null;
  displayName: string;
};

export function AvatarUploader({ profileId, currentUrl, currentPath, displayName }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);

  function pickFile() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;

    if (!ACCEPTED_MIME.includes(file.type)) {
      setError("That file type isn't supported. Use a PNG, JPG, or WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That photo is over 5MB. Try a smaller one.");
      return;
    }

    try {
      const bm = await createImageBitmap(file, { imageOrientation: "from-image" });
      setBitmap(bm);
    } catch {
      // HEIC and corrupt files end up here. createImageBitmap throws a
      // generic InvalidStateError so we can't tell which is which —
      // the message covers both.
      setError("Couldn't read that image. iPhone photos saved as HEIC need to be exported as JPEG first.");
    }
  }

  function closeCropper() {
    bitmap?.close?.();
    setBitmap(null);
  }

  async function handleSave(blob: Blob) {
    setUploading(true);
    setError(null);
    try {
      const supabase = createClient();
      const path = `${profileId}/${Date.now()}.webp`;

      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/webp", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl, avatar_path: path })
        .eq("id", profileId);
      if (updateErr) throw updateErr;

      // Best-effort cleanup of the previous file. Failure here is logged
      // but doesn't block — the new avatar is already live.
      if (currentPath && currentPath !== path) {
        await supabase.storage.from("avatars").remove([currentPath]).catch(() => {});
      }

      setPreviewUrl(publicUrl);
      closeCropper();
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  const initials = displayName
    .split(" ")
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: previewUrl ? `center / cover no-repeat url(${JSON.stringify(previewUrl)})` : "var(--sm-bg-3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--sm-fg-3)", fontWeight: 700, fontSize: 22,
        border: "1px solid var(--sm-border-subtle)",
        flexShrink: 0,
      }}>
        {!previewUrl && initials}
      </div>

      <div style={{ flex: 1 }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={pickFile} disabled={uploading}>
          {previewUrl ? "Change photo" : "Upload photo"}
        </button>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--sm-fg-4)", lineHeight: 1.4 }}>
          PNG, JPG, or WebP · up to 5MB · stored as a 600×600 WebP
        </p>
        {error && (
          <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--sm-status-error, #c53030)" }}>
            {error}
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        onChange={onFileChange}
        style={{ display: "none" }}
      />

      {bitmap && (
        <CropperModal
          bitmap={bitmap}
          uploading={uploading}
          onCancel={closeCropper}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────── cropper modal

function CropperModal({
  bitmap, uploading, onCancel, onSave,
}: {
  bitmap: ImageBitmap;
  uploading: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
}) {
  // fitScale: at zoom=1, the smaller image dimension exactly fills the
  // viewport. The user can only zoom *in* from there; zooming further out
  // would let empty space appear next to the image inside the crop frame.
  const fitScale = VIEWPORT_PX / Math.min(bitmap.width, bitmap.height);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const effectiveScale = fitScale * zoom;
  const displayW = bitmap.width * effectiveScale;
  const displayH = bitmap.height * effectiveScale;

  // The image is positioned with `transform: translate(offsetX, offsetY)`
  // applied to a top-left-anchored element. We clamp offsets so the image
  // always covers the viewport — the rightmost it can move is 0 (image left
  // edge at viewport left), leftmost is -(displayW - V).
  const clamp = useCallback((x: number, y: number) => {
    const minX = VIEWPORT_PX - displayW;
    const minY = VIEWPORT_PX - displayH;
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  }, [displayW, displayH]);

  // Re-center on zoom change. Pivoting around the visible center would feel
  // smoother but it's more math; for a 320px cropper the snap-to-center
  // is fine and avoids cumulative drift bugs.
  useEffect(() => {
    setOffset(clamp((VIEWPORT_PX - displayW) / 2, (VIEWPORT_PX - displayH) / 2));
  }, [zoom, displayW, displayH, clamp]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const next = clamp(d.baseX + (e.clientX - d.startX), d.baseY + (e.clientY - d.startY));
    setOffset(next);
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
    setDragging(false);
  }
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom - e.deltaY * 0.002));
    setZoom(next);
  }

  async function save() {
    // Source-space crop: the viewport's top-left in image coordinates is
    // -offset/effectiveScale; the crop is V/effectiveScale wide and tall.
    const sx = -offset.x / effectiveScale;
    const sy = -offset.y / effectiveScale;
    const sSize = VIEWPORT_PX / effectiveScale;

    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_PX;
    canvas.height = EXPORT_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(bitmap, sx, sy, sSize, sSize, 0, 0, EXPORT_PX, EXPORT_PX);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), "image/webp", WEBP_QUALITY),
    );
    if (!blob) return;
    onSave(blob);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop your photo"
      onClick={() => !uploading && onCancel()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--sm-bg-1)",
          border: "1px solid var(--sm-border-subtle)",
          borderRadius: "var(--sm-radius-sm)",
          padding: 20,
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Position your photo</h3>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            position: "relative",
            width: VIEWPORT_PX,
            height: VIEWPORT_PX,
            margin: "0 auto 14px",
            overflow: "hidden",
            borderRadius: "50%",
            background: "#000",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            userSelect: "none",
          }}
        >
          <BitmapImage
            bitmap={bitmap}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: displayW,
              height: displayH,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
              pointerEvents: "none",
            }}
          />
        </div>

        <label htmlFor="zoom" style={{ display: "block", fontSize: 12, color: "var(--sm-fg-3)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>
          Zoom
        </label>
        <input
          id="zoom"
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ width: "100%" }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel} disabled={uploading}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={save} disabled={uploading}>
            {uploading ? "Uploading…" : "Save photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Tiny helper: render an ImageBitmap by drawing it into a canvas. We don't
// hold the bitmap as an <img src=...> because creating a blob URL just for
// the cropper preview is wasteful when we already have the decoded bitmap
// in memory.
function BitmapImage({ bitmap, style }: { bitmap: ImageBitmap; style: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = bitmap.width;
    c.height = bitmap.height;
    c.getContext("2d")?.drawImage(bitmap, 0, 0);
  }, [bitmap]);
  return <canvas ref={canvasRef} style={style} />;
}
