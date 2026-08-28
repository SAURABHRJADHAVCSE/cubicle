import { ImageResponse } from "next/og";

export const runtime = "edge";

/** A fixed, predictable URL (unlike Next's icon.tsx convention, which
 * hashes its own query string) — referenced directly from manifest.json's
 * icons array so Android/iOS install prompts get a real 512px PNG. */
// Same maskable safe-zone reasoning as icon-192 — scaled 512/192 ≈ 2.67x.
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
        <div style={{ display: "flex", flexDirection: "column", gap: 38 }}>
          <div style={{ display: "flex", gap: 38 }}>
            <div style={{ width: 96, height: 96, background: "white", borderRadius: 24 }} />
            <div style={{ width: 96, height: 96, background: "white", borderRadius: 24 }} />
          </div>
          <div style={{ display: "flex", gap: 38 }}>
            <div style={{ width: 96, height: 96, background: "white", borderRadius: 24 }} />
            <div style={{ width: 96, height: 96, background: "white", borderRadius: 24 }} />
          </div>
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
