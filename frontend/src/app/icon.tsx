import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A 2x2 "cubicle window" grid rather than a plain letter — reads at a
// glance in a browser tab and, more importantly, actually survives the
// aggressive circle/squircle masking Android launchers apply to PWA icons
// (see icon-192/icon-512 below) instead of just getting cropped at a hard
// edge like a full-bleed glyph would.
function CubicleGrid({ square, gap }: { square: number; gap: number }) {
  const dot = { width: square, height: square, background: "white", borderRadius: square / 4 };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <div style={{ display: "flex", gap }}>
        <div style={dot} />
        <div style={dot} />
      </div>
      <div style={{ display: "flex", gap }}>
        <div style={dot} />
        <div style={dot} />
      </div>
    </div>
  );
}

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <CubicleGrid square={7} gap={3} />
      </div>
    ),
    size,
  );
}
