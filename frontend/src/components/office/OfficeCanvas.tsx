"use client";

import { Canvas } from "@react-three/fiber";

import { Office } from "@/components/office/Office";

interface OfficeCanvasProps {
  onContextLost?: () => void;
}

/**
 * <Canvas> creates a WebGL context at mount, touching document/navigator —
 * must stay client-only. Isolated in its own module so app/page.tsx can
 * next/dynamic(ssr:false) it. OrbitControls intentionally absent — see
 * Office.tsx's CameraRig comment.
 *
 * dpr is pinned to 1 (not the default `[1, 2]` clamp-to-devicePixelRatio):
 * on a HiDPI display this panel is a large chunk of the viewport, so
 * rendering at 2x device pixel ratio is up to 4x the fragment-shader cost
 * for no real gain — a contributor to the GPU driver TDR resets
 * (WebGLRenderer: Context Lost) seen in testing. No shadows either, for
 * the same reason (shadow mapping is usually the single biggest GPU cost
 * in a scene like this).
 */
export function OfficeCanvas({ onContextLost }: OfficeCanvasProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 38, near: 0.1, far: 100 }}
      className="!absolute inset-0"
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onContextLost?.();
          },
          { once: true },
        );
      }}
    >
      <Office />
    </Canvas>
  );
}
