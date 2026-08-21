"use client";

import Spline from "@splinetool/react-spline";
import type { Application } from "@splinetool/runtime";

import { SPLINE_SCENE_URL } from "@/lib/spline";

/** Isolated in its own module so it can be `next/dynamic(..., { ssr: false })`
 * imported — @splinetool/runtime's WASM assets (Draco/boolean-ops) don't
 * resolve through Turbopack's server/SSR bundling pass otherwise.
 *
 * @splinetool/runtime is pinned to 1.12.98, not "latest": the 2.0.x line
 * (2.0.1–2.0.5, current as of writing) ships a genuinely broken package —
 * runtime-DRACOLoader-TQHJ6SJB.js references draco_decoder.js/.wasm and
 * draco_wasm_wrapper.js that aren't in the published tarball, and
 * boolean.js looks for boolean_wasm_bg.wasm when the shipped file is named
 * boolean.wasm. This 500s the page under both Turbopack and webpack — it's
 * a packaging bug, not a bundler incompatibility. 1.12.98 doesn't bundle
 * local WASM at all (fetches decoder assets from Spline's CDN instead), so
 * it isn't affected. Revisit the pin once upstream ships a fixed 2.x.
 */
export default function SplineCanvas({ onLoad }: { onLoad: (app: Application) => void }) {
  return <Spline scene={SPLINE_SCENE_URL} onLoad={onLoad} />;
}
