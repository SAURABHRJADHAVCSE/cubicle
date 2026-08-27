import { ImageResponse } from "next/og";

export const runtime = "edge";

/** A fixed, predictable URL (unlike Next's icon.tsx convention, which
 * hashes its own query string) — referenced directly from manifest.json's
 * icons array so Android/iOS install prompts get a real 192px PNG. */
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
          background: "#6366f1",
          color: "white",
          fontSize: 128,
          fontWeight: 700,
        }}
      >
        C
      </div>
    ),
    { width: 192, height: 192 },
  );
}
