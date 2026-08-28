import { ImageResponse } from "next/og";

export const runtime = "edge";

/** A fixed, predictable URL (unlike Next's icon.tsx convention, which
 * hashes its own query string) — referenced directly from manifest.json's
 * icons array so Android/iOS install prompts get a real 192px PNG. */
// manifest.json marks this "maskable" — Android launchers crop it to a
// circle/squircle/whatever the OEM picks, keeping only the center ~66% "safe
// zone". The old plain-letter icon filled the full square, so masking cut
// the glyph's edges off; this keeps the grid glyph well inside that zone.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #4135dd, #6a5cf0)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ width: 36, height: 36, background: "white", borderRadius: 9 }} />
            <div style={{ width: 36, height: 36, background: "white", borderRadius: 9 }} />
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ width: 36, height: 36, background: "white", borderRadius: 9 }} />
            <div style={{ width: 36, height: 36, background: "white", borderRadius: 9 }} />
          </div>
        </div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
