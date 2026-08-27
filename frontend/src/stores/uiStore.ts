import { create } from "zustand";

interface UIState {
  selectedAgentId: string | null;
  selectAgent: (agentId: string | null) => void;
  activeCallAgentId: string | null;
  selectCallAgent: (agentId: string | null) => void;
}

/** Which agent's chat panel (or voice call) is open — shared between
 * AgentCard clicks and the ChatPanel/CallPanel/office view without
 * threading props through every layer.
 */
export const useUIStore = create<UIState>((set) => ({
  selectedAgentId: null,
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
  activeCallAgentId: null,
  selectCallAgent: (agentId) => set({ activeCallAgentId: agentId }),
}));
