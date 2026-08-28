import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own corner rounding to whatever square it's given, so no
// extra padding/rounding is needed here — full-bleed background, same
// "cubicle window" grid glyph as icon.tsx/manifest icons for consistency.
export default function AppleIcon() {
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 40, height: 40, background: "white", borderRadius: 10 }} />
            <div style={{ width: 40, height: 40, background: "white", borderRadius: 10 }} />
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ width: 40, height: 40, background: "white", borderRadius: 10 }} />
            <div style={{ width: 40, height: 40, background: "white", borderRadius: 10 }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
