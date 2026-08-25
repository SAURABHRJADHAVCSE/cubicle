import type { Agent } from "@/types/agent";

export interface DeskLayout {
  agentId: string;
  position: [number, number, number];
  rotationY: number;
}

const DESK_SPACING_X = 2.2;
const DESK_SPACING_Z = 2.4;

/**
 * Square-ish grid, centered on the origin, that reflows automatically as
 * agents are added/removed. `desk_position` is only ever used as an
 * ordering hint here (it was never a real coordinate, even under Spline —
 * just an opaque key into a `desk-{n}-{status}` object-name string), so
 * agents without one sort last rather than being dropped.
 */
export function computeDeskLayout(agents: Agent[]): DeskLayout[] {
  const count = agents.length || 1;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const offsetX = ((cols - 1) * DESK_SPACING_X) / 2;
  const offsetZ = ((rows - 1) * DESK_SPACING_Z) / 2;

  const ordered = [...agents].sort(
    (a, b) => (a.desk_position ?? Infinity) - (b.desk_position ?? Infinity),
  );

  return ordered.map((agent, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      agentId: agent.id,
      position: [col * DESK_SPACING_X - offsetX, 0, row * DESK_SPACING_Z - offsetZ],
      rotationY: 0,
    };
  });
}

const ROOM_PADDING_X = 3;
const ROOM_PADDING_Z = 4;
const MIN_ROOM_WIDTH = 8;
const MIN_ROOM_DEPTH = 8;

export function computeLayoutBounds(layout: DeskLayout[]): { width: number; depth: number } {
  if (layout.length === 0) return { width: MIN_ROOM_WIDTH, depth: MIN_ROOM_DEPTH };

  const xs = layout.map((d) => d.position[0]);
  const zs = layout.map((d) => d.position[2]);
  const width = Math.max(MIN_ROOM_WIDTH, Math.max(...xs) - Math.min(...xs) + DESK_SPACING_X + ROOM_PADDING_X * 2);
  const depth = Math.max(MIN_ROOM_DEPTH, Math.max(...zs) - Math.min(...zs) + DESK_SPACING_Z + ROOM_PADDING_Z * 2);
  return { width, depth };
}

/** Raw footprint of the desk grid, no room padding — used by Office.tsx to
 * compose the desk zone with a fixed-size cafeteria zone into one room. */
export function computeDeskExtent(layout: DeskLayout[]): { width: number; depth: number } {
  if (layout.length === 0) return { width: DESK_SPACING_X, depth: DESK_SPACING_Z };

  const xs = layout.map((d) => d.position[0]);
  const zs = layout.map((d) => d.position[2]);
  return {
    width: Math.max(...xs) - Math.min(...xs) + DESK_SPACING_X,
    depth: Math.max(...zs) - Math.min(...zs) + DESK_SPACING_Z,
  };
}
