"use client";

import { useEffect, useState } from "react";

import { getAuthToken } from "@/lib/authToken";
import { api } from "@/lib/api";

interface WorkspaceFileState {
  objectUrl: string | null;
  loading: boolean;
  error: string | null;
}

/** Fetches a workspace file (see api.agents.rawFileUrl) as a Blob and
 * exposes it as an object URL — an `<img src>`/`<video src>` can't be
 * pointed at the raw route directly since every route on this router
 * requires a bearer token that a media tag has no way to send. Revokes the
 * object URL on unmount/path change so a task list rendering many results
 * doesn't leak one blob URL per file forever. */
export function useWorkspaceFile(agentId: string, path: string): WorkspaceFileState {
  const [state, setState] = useState<WorkspaceFileState>({
    objectUrl: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to "loading" when agentId/path changes, not an incidental side effect
    setState({ objectUrl: null, loading: true, error: null });

    async function load() {
      try {
        const token = getAuthToken();
        const response = await fetch(api.agents.rawFileUrl(agentId, path), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
          throw new Error(`Couldn't load file (${response.status})`);
        }
        const blob = await response.blob();
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setState({ objectUrl: currentUrl, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          objectUrl: null,
          loading: false,
          error: err instanceof Error ? err.message : "Couldn't load file",
        });
      }
    }
    void load();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [agentId, path]);

  return state;
}
