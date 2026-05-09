// Shared avatar tile. Renders the user's uploaded image when present,
// otherwise their initials on a deterministic pastel background.
//
// Six call sites used to inline this with identical AV_COLORS / AV_TEXT
// arrays — one drift would have been enough to make the colors flicker
// across screens. Funnel them through here so the rotation, sizing, and
// fallback logic stays consistent.

const AV_COLORS = ["#f5d8b8", "#d8e4f5", "#d8f5dd", "#f5d8d8", "#ebd8f5", "#f5ecd8"];
const AV_TEXT   = ["#8a5a05", "#1159af", "#13612e", "#b82105", "#5b1faf", "#8a5a05"];

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .map(w => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export type AvatarShape = "round" | "rounded";

type Props = {
  src: string | null | undefined;
  name: string;
  size: number;
  // Index into the color palette. Pass a stable hash (list index, char code,
  // etc.) so the same person gets the same color across renders.
  colorIndex?: number;
  shape?: AvatarShape;
  className?: string;
  /** Override font size; defaults to ~38% of the tile. */
  fontSize?: number;
};

export function Avatar({
  src, name, size, colorIndex = 0, shape = "rounded", className, fontSize,
}: Props) {
  const idx = ((colorIndex % AV_COLORS.length) + AV_COLORS.length) % AV_COLORS.length;
  const radius = shape === "round" ? "50%" : "var(--sm-radius-sm)";
  const fs = fontSize ?? Math.max(10, Math.round(size * 0.38));

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s avatar` : "Avatar"}
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      aria-label={name ? `${name}'s initials` : "Initials"}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: AV_COLORS[idx],
        color: AV_TEXT[idx],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: fs,
        flexShrink: 0,
      }}
    >
      {initialsOf(name)}
    </div>
  );
}
