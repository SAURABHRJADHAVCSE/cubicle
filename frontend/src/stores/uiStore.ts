import { create } from "zustand";

interface UIState {
  selectedAgentId: string | null;
  selectAgent: (agentId: string | null) => void;
  activeCallAgentId: string | null;
  selectCallAgent: (agentId: string | null) => void;
  activeFilesAgentId: string | null;
  selectFilesAgent: (agentId: string | null) => void;
  activeTeamAgentId: string | null;
  selectTeamAgent: (agentId: string | null) => void;
  activeConfigAgentId: string | null;
  selectConfigAgent: (agentId: string | null) => void;
  taskViewMode: "list" | "board";
  setTaskViewMode: (mode: "list" | "board") => void;
}

/** Which agent's chat panel (or voice call, workspace file browser,
 * teammate roster, or engine config) is open — shared between AgentCard
 * clicks and the ChatPanel/CallPanel/FilesPanel/TeamPanel/AgentConfigPanel/
 * office view without threading props through every layer.
 */
export const useUIStore = create<UIState>((set) => ({
  selectedAgentId: null,
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
  activeCallAgentId: null,
  selectCallAgent: (agentId) => set({ activeCallAgentId: agentId }),
  activeFilesAgentId: null,
  selectFilesAgent: (agentId) => set({ activeFilesAgentId: agentId }),
  activeTeamAgentId: null,
  selectTeamAgent: (agentId) => set({ activeTeamAgentId: agentId }),
  activeConfigAgentId: null,
  selectConfigAgent: (agentId) => set({ activeConfigAgentId: agentId }),
  taskViewMode: "list",
  setTaskViewMode: (mode) => set({ taskViewMode: mode }),
}));
