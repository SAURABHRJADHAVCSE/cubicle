import { getApiUrl } from "@/lib/constants";
import { clearAuthToken, getAuthToken } from "@/lib/authToken";
import type {
  Agent,
  AgentCreate,
  AgentUpdate,
  WorkspaceFileContent,
  WorkspaceListing,
} from "@/types/agent";
import type {
  AuthStatus,
  Device,
  DeviceToken,
  PairingToken,
  PushConfig,
} from "@/types/auth";
import type { CallConfig } from "@/types/call";
import type { ChatRequest, ConversationMessage } from "@/types/chat";
import type { ClaudeAuthStart, ClaudeAuthStatus } from "@/types/settings";
import type { Task, TaskCreate, TaskUpdate } from "@/types/task";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    // A 401 on an authenticated request means the token was revoked (or
    // expired) server-side — bounce back to the login screen. Login/setup
    // themselves can legitimately 401/409 (wrong password) without a token
    // to clear, so this is a harmless no-op there.
    if (response.status === 401 && token) clearAuthToken();
    const body = await response.text();
    throw new ApiError(response.status, body || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  auth: {
    status: () => request<AuthStatus>("/auth/status"),
    setup: (password: string, deviceName: string) =>
      request<DeviceToken>("/auth/setup", {
        method: "POST",
        body: JSON.stringify({ password, device_name: deviceName }),
      }),
    login: (password: string, deviceName: string) =>
      request<DeviceToken>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password, device_name: deviceName }),
      }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<void>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }),
  },
  devices: {
    list: () => request<Device[]>("/devices"),
    pairingToken: () => request<PairingToken>("/devices/pairing-token", { method: "POST" }),
    pair: (pairingToken: string, deviceName: string) =>
      request<DeviceToken>("/devices/pair", {
        method: "POST",
        body: JSON.stringify({ pairing_token: pairingToken, device_name: deviceName }),
      }),
    revoke: (id: string) => request<void>(`/devices/${id}`, { method: "DELETE" }),
    pushConfig: () => request<PushConfig>("/devices/push-config"),
    savePushSubscription: (subscription: PushSubscriptionJSON) =>
      request<void>("/devices/me/push-subscription", {
        method: "PUT",
        body: JSON.stringify({ subscription }),
      }),
    deletePushSubscription: () =>
      request<void>("/devices/me/push-subscription", { method: "DELETE" }),
  },
  calls: {
    config: () => request<CallConfig>("/calls/config"),
  },
  engines: {
    list: () => request<Record<string, boolean>>("/engines"),
  },
  agents: {
    list: () => request<Agent[]>("/agents"),
    get: (id: string) => request<Agent>(`/agents/${id}`),
    create: (payload: AgentCreate) =>
      request<Agent>("/agents", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: AgentUpdate) =>
      request<Agent>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (id: string) => request<void>(`/agents/${id}`, { method: "DELETE" }),
    listFiles: (id: string, path = "") =>
      request<WorkspaceListing>(`/agents/${id}/files?path=${encodeURIComponent(path)}`),
    readFile: (id: string, path: string) =>
      request<WorkspaceFileContent>(`/agents/${id}/files/content?path=${encodeURIComponent(path)}`),
  },
  tasks: {
    list: () => request<Task[]>("/tasks"),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (payload: TaskCreate) =>
      request<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
    execute: (id: string) => request<Task>(`/tasks/${id}/execute`, { method: "POST" }),
    update: (id: string, payload: TaskUpdate) =>
      request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  },
  chat: {
    history: (agentId: string) =>
      request<ConversationMessage[]>(`/agents/${agentId}/conversations`),
    send: (agentId: string, payload: ChatRequest) =>
      request<ConversationMessage>(`/agents/${agentId}/chat`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  settings: {
    claudeAuthStatus: () => request<ClaudeAuthStatus>("/settings/claude-auth/status"),
    claudeAuthStart: () =>
      request<ClaudeAuthStart>("/settings/claude-auth/start", { method: "POST" }),
    claudeAuthComplete: (code: string) =>
      request<void>("/settings/claude-auth/complete", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    claudeAuthCancel: () =>
      request<void>("/settings/claude-auth/cancel", { method: "POST" }),
  },
};
