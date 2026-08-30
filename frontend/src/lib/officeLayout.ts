import type { Agent } from "@/types/agent";

export interface DeskLayout {
  agentId: string;
  position: [number, number, number];
  rotationY: number;
}

export const WORKSTATION_SLOTS: Omit<DeskLayout, "agentId">[] = [
  ...[-6.4, -3.2, 0, 3.2, 6.4].map((x) => ({
    position: [x, 0, 0.7] as [number, number, number],
    rotationY: 0,
  })),
  ...[-6.4, -3.2, 0, 3.2, 6.4].map((x) => ({
    position: [x, 0, 4.2] as [number, number, number],
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
    const col = overflowIndex % 5;
    const row = Math.floor(overflowIndex / 5);
    return {
      agentId: agent.id,
      position: [-6.4 + col * 3.2, 0, 7.5 + row * 3.2],
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

const CAFE_SEAT_SPACING_X = 0.9;
const CAFE_TABLE_Z = -5.05;
const CAFE_TABLE_CENTER_X = -6.4;
const CAFE_SEATS_PER_SIDE = 4;

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
  return ordered.map((agent, i) => {
    if (i >= CAFE_SEATS_PER_SIDE * 2) {
      const sofaSeat = i - CAFE_SEATS_PER_SIDE * 2;
      return {
        agentId: agent.id,
        position: [-3.67 + sofaSeat * 0.78, 0, -6.19],
        rotationY: 0,
      };
    }

    const side = Math.floor(i / CAFE_SEATS_PER_SIDE);
    const column = i % CAFE_SEATS_PER_SIDE;
    const seatsOnThisSide = Math.min(
      CAFE_SEATS_PER_SIDE,
      ordered.length - side * CAFE_SEATS_PER_SIDE,
    );
    const offsetX = ((seatsOnThisSide - 1) * CAFE_SEAT_SPACING_X) / 2;
    const isRearSide = side % 2 === 1;
    return {
      agentId: agent.id,
      position: [
        CAFE_TABLE_CENTER_X + column * CAFE_SEAT_SPACING_X - offsetX,
        0,
        CAFE_TABLE_Z,
      ],
      rotationY: isRearSide ? Math.PI : 0,
    };
  });
}
