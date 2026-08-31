import { create } from "zustand";

interface UIState {
  selectedAgentId: string | null;
  selectAgent: (agentId: string | null) => void;
  activeCallAgentId: string | null;
  selectCallAgent: (agentId: string | null) => void;
  activeFilesAgentId: string | null;
  selectFilesAgent: (agentId: string | null) => void;
  activeManageAgentId: string | null;
  selectManageAgent: (agentId: string | null) => void;
  taskViewMode: "list" | "board";
  setTaskViewMode: (mode: "list" | "board") => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

/** Which agent's chat panel (or voice call, workspace file browser, or
 * manage panel — engine config + team, see AgentManagePanel.tsx) is open —
 * shared between AgentCard clicks and the
 * ChatPanel/CallPanel/FilesPanel/AgentManagePanel/office view without
 * threading props through every layer.
 */
export const useUIStore = create<UIState>((set) => ({
  selectedAgentId: null,
  selectAgent: (agentId) => set({ selectedAgentId: agentId }),
  activeCallAgentId: null,
  selectCallAgent: (agentId) => set({ activeCallAgentId: agentId }),
  activeFilesAgentId: null,
  selectFilesAgent: (agentId) => set({ activeFilesAgentId: agentId }),
  activeManageAgentId: null,
  selectManageAgent: (agentId) => set({ activeManageAgentId: agentId }),
  taskViewMode: "list",
  setTaskViewMode: (mode) => set({ taskViewMode: mode }),
  // Global (not per-agent) so any component — e.g. CallPanel's "voice
  // provider not configured" shortcut — can open Settings directly,
  // not just the header's own gear button.
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
