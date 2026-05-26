import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Sunday Musician — connect worship musicians with churches";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "sans-serif",
          padding: "0 80px",
        }}
      >
        {/* Accent bar at top */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 8, background: "#e47b02" }} />

        {/* Logo mark — musical note */}
        <div style={{ fontSize: 80, marginBottom: 24 }}>🎵</div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#1f2933",
            letterSpacing: "-2px",
            marginBottom: 20,
          }}
        >
          Sunday Musician
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: "#627d98",
            textAlign: "center",
            maxWidth: 780,
            lineHeight: 1.4,
          }}
        >
          Find and book worship musicians for your church — or discover opportunities as a musician.
        </div>

        {/* Accent bar at bottom */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, background: "#e47b02" }} />
      </div>
    ),
    { ...size },
  );
}
