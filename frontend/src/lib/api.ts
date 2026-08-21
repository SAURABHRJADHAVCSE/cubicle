import { API_URL } from "@/lib/constants";
import type { Agent, AgentCreate, AgentUpdate } from "@/types/agent";
import type { Task, TaskCreate } from "@/types/task";

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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, body || response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
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
  },
  tasks: {
    list: () => request<Task[]>("/tasks"),
    get: (id: string) => request<Task>(`/tasks/${id}`),
    create: (payload: TaskCreate) =>
      request<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
    execute: (id: string) => request<Task>(`/tasks/${id}/execute`, { method: "POST" }),
  },
};
