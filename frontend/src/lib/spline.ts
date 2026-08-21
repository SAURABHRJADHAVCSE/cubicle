/**
 * Placeholder Spline scene (from @splinetool/react-spline's own README
 * examples: https://github.com/splinetool/react-spline). cubicle_spec.md
 * calls for a custom-built 4-desk office scene with named events per
 * agent state, which nobody has designed in Spline yet. This wires the
 * full integration — component, state→event bridge, desk mapping — against
 * this public demo scene so it's a drop-in swap: replace SPLINE_SCENE_URL
 * with a real .splinecode export and rename the object triggers below to
 * match whatever's actually in that scene.
 */
export const SPLINE_SCENE_URL = "https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode";

export type AgentSplineStatus = "idle" | "working" | "thinking" | "break" | "offline";

/**
 * Maps a desk position + status to the Spline object name this project
 * expects that state's animation to be wired to, e.g. `desk-0-working`.
 * These names don't exist in the placeholder scene above (so calls
 * against it are harmless no-ops) — set your real scene's object names to
 * match this convention, or edit this function to match theirs instead.
 */
export function splineObjectNameFor(deskPosition: number, status: AgentSplineStatus): string {
  return `desk-${deskPosition}-${status}`;
}
