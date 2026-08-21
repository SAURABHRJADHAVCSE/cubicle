import { create } from "zustand";

interface UIState {
  selectedAgentId: string | null;
  selectAgent: (agentId: string | null) => void;
}

/** Which agent's chat panel is open — shared between AgentCard clicks and
 * the ChatPanel/office view without threading props through every layer.
 */
export const useUIStore = create<UIState>((set) => ({
  selectedAgentId: null,
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
}));
