import type { Agent } from "@/types/agent";

export interface DeskLayout {
  agentId: string;
  position: [number, number, number];
  rotationY: number;
}

export const WORKSTATION_SLOTS: Omit<DeskLayout, "agentId">[] = [
  ...[-4.8, -1.6, 1.6, 4.8].map((x) => ({
    position: [x, 0, 0.25] as [number, number, number],
    rotationY: 0,
  })),
  ...[-4.8, -1.6, 1.6, 4.8].map((x) => ({
    position: [x, 0, 3.15] as [number, number, number],
    rotationY: 0,
  })),
];

/**
 * Two long rows facing a shared central walkway, extending forward (+Z, away
 * from the CEO cabin) as more agents join — not a reflowing grid. Agents
 * alternate left/right row by index, so both rows grow at roughly the same
 * rate rather than filling one row before starting the next.
 * `desk_position` is only ever used as an ordering hint (see the original
 * note this replaced: it was never a real coordinate, just an opaque
 * ordering key), so agents without one sort last rather than being dropped.
 */
export function computeDeskLayout(agents: Agent[]): DeskLayout[] {
  const ordered = [...agents].sort(
    (a, b) => (a.desk_position ?? Infinity) - (b.desk_position ?? Infinity),
  );

  return ordered.map((agent, i) => {
    const fixed = WORKSTATION_SLOTS[i];
    if (fixed) return { agentId: agent.id, ...fixed };

    const overflowIndex = i - WORKSTATION_SLOTS.length;
    const col = overflowIndex % 4;
    const row = Math.floor(overflowIndex / 4);
    return {
      agentId: agent.id,
      position: [-4.8 + col * 3.2, 0, 5.95 + row * 2.9],
      rotationY: 0,
    };
  });
}

/** How far the two cubicle rows currently extend in +Z — Office.tsx uses
 * this to size the floor/walls so they always cover every desk, however
 * many agents have joined. */
export function computeRowDepth(layout: DeskLayout[]): number {
  if (layout.length === 0) return 5.8;
  return Math.max(5.8, Math.max(...layout.map((desk) => desk.position[2])) + 1.5);
}

const WAITING_SEAT_SPACING_X = 0.9;
const WAITING_ROW_Z = -2.85;
const WAITING_CENTER_X = -4.55;
const WAITING_MAX_PER_ROW = 4;
const WAITING_ROW_SPACING_Z = 0.9;

/**
 * Where an agent stands/sits while it has no task assigned — clustered in
 * the waiting area at the front of the office, facing back toward the
 * cubicle rows it'll walk to once given work. Same stable-ordering idea as
 * computeDeskLayout: keyed by the full roster (not just currently-idle
 * agents) so a given agent's waiting spot doesn't jump around as *other*
 * agents' statuses change.
 */
export function computeQueueLayout(agents: Agent[]): DeskLayout[] {
  const ordered = [...agents].sort(
    (a, b) => (a.desk_position ?? Infinity) - (b.desk_position ?? Infinity),
  );
  const perRow = Math.min(WAITING_MAX_PER_ROW, Math.max(1, ordered.length));
  const offsetX = ((Math.min(perRow, ordered.length) - 1) * WAITING_SEAT_SPACING_X) / 2;

  return ordered.map((agent, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    return {
      agentId: agent.id,
      position: [WAITING_CENTER_X + col * WAITING_SEAT_SPACING_X - offsetX, 0, WAITING_ROW_Z + row * WAITING_ROW_SPACING_Z],
      rotationY: 0,
    };
  });
}
