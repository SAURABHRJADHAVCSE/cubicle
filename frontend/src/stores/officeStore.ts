import { create } from "zustand";

import type { Agent, AgentStatus } from "@/types/agent";

export type AnimationState = "idle" | "working" | "walking" | "celebrating";

export interface AgentSceneState {
  status: AgentStatus;
  animationState: AnimationState;
  /** Unused today — hook for the V0.2 social scheduler's walk-to-target animation. */
  targetPosition: [number, number, number] | null;
}

const CELEBRATION_DURATION_MS = 3000;
const celebrationTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

interface OfficeStoreState {
  agents: Record<string, AgentSceneState>;
  setAgentStatus: (agentId: string, status: AgentStatus) => void;
  syncFromRoster: (agents: Agent[]) => void;
  triggerCelebration: (agentId: string) => void;
}

function deriveAnimationState(status: AgentStatus): AnimationState {
  switch (status) {
    case "working":
    case "thinking":
      return "working";
    case "idle":
    case "break":
    case "offline":
      return "idle";
    default:
      return "idle";
  }
}

export const useOfficeStore = create<OfficeStoreState>((set, get) => ({
  agents: {},
  setAgentStatus: (agentId, status) =>
    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: {
          status,
          animationState: deriveAnimationState(status),
          targetPosition: state.agents[agentId]?.targetPosition ?? null,
        },
      },
    })),
  syncFromRoster: (roster) =>
    set((state) => {
      const agents: Record<string, AgentSceneState> = {};
      for (const agent of roster) {
        agents[agent.id] = state.agents[agent.id] ?? {
          status: agent.status,
          animationState: deriveAnimationState(agent.status),
          targetPosition: null,
        };
      }
      return { agents };
    }),
  triggerCelebration: (agentId) => {
    const existing = get().agents[agentId];
    if (!existing) return;

    set((state) => ({
      agents: {
        ...state.agents,
        [agentId]: { ...state.agents[agentId], animationState: "celebrating" },
      },
    }));

    // A rapid re-trigger (two tasks finishing close together) should extend
    // the celebration rather than race a shorter earlier timeout to revert
    // it early.
    clearTimeout(celebrationTimeouts[agentId]);
    celebrationTimeouts[agentId] = setTimeout(() => {
      set((state) => {
        const current = state.agents[agentId];
        if (!current) return state;
        return {
          agents: {
            ...state.agents,
            [agentId]: { ...current, animationState: deriveAnimationState(current.status) },
          },
        };
      });
    }, CELEBRATION_DURATION_MS);
  },
}));
