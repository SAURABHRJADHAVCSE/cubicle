"use client";

import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCancelClaudeAuth,
  useClaudeAuthStatus,
  useCompleteClaudeAuth,
  useStartClaudeAuth,
} from "@/hooks/useClaudeAuth";

/**
 * Lets the user connect the Claude Code CLI to their Claude subscription
 * without touching a terminal: starts `claude setup-token` on the server,
 * surfaces the OAuth URL to click, and relays the code they paste back.
 */
export function ClaudeAuthCard() {
  const { data: status, isLoading: statusLoading } = useClaudeAuthStatus();
  const startAuth = useStartClaudeAuth();
  const completeAuth = useCompleteClaudeAuth();
  const cancelAuth = useCancelClaudeAuth();

  const [code, setCode] = useState("");

  function handleConnect() {
    startAuth.mutate(undefined, {
      onSuccess: (data) => {
        window.open(data.auth_url, "_blank", "noopener,noreferrer");
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Couldn't start the connection");
      },
    });
  }

  function handleSubmitCode() {
    completeAuth.mutate(code, {
      onSuccess: () => {
        toast.success("Claude Code connected");
        setCode("");
        startAuth.reset();
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "That code didn't work — try again");
      },
    });
  }

  const isConnected = Boolean(status?.connected);
  const awaitingCode = startAuth.isSuccess;

  // The explicit "Cancel" button below already tells the backend to kill
  // the `claude setup-token` subprocess it spawned — but this card can also
  // disappear other ways (Settings dialog closed, browser back button,
  // backing out of the Add Agent stepper mid-flow) that just unmount it
  // with no click involved. Without this, that leaves a live subprocess and
  // a stuck "connection attempt already in progress" lock server-side that
  // nothing in the UI can clear — the exact bug this fixes.
  const awaitingCodeRef = useRef(awaitingCode);
  useEffect(() => {
    awaitingCodeRef.current = awaitingCode;
  }, [awaitingCode]);
  useEffect(() => {
    return () => {
      if (awaitingCodeRef.current) cancelAuth.mutate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel rounded-lg border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-bold tracking-wide text-foreground uppercase">
          Claude Code CLI
        </h3>
        {!statusLoading && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-4xs font-bold ${
              isConnected
                ? "border-success/30 bg-success/15 text-success"
                : "border-border bg-secondary text-muted-foreground"
            }`}
          >
            {isConnected ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
            {isConnected ? "Connected" : "Not connected"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Connect your Claude subscription so CLI-engine agents run on your plan instead of
        pay-per-token API billing.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {!awaitingCode && (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={startAuth.isPending}
            className="w-fit rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            {startAuth.isPending
              ? "Starting…"
              : isConnected
                ? "Reconnect"
                : "Connect Claude Code"}
          </Button>
        )}

        {awaitingCode && startAuth.data && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-3">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              1. Sign in at the tab that just opened (or{" "}
              <a
                href={startAuth.data.auth_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4"
              >
                open it again <ExternalLink className="size-3" />
              </a>
              ), then paste the code it gives you back here.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claude-auth-code" className="text-xs text-slate-600 dark:text-slate-300">
                Authorization code
              </Label>
              <div className="flex gap-2">
                <Input
                  id="claude-auth-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste the code here"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmitCode()}
                  className="border-border bg-card rounded-lg"
                />
                <Button
                  size="sm"
                  onClick={handleSubmitCode}
                  disabled={!code.trim() || completeAuth.isPending}
                  className="rounded-lg bg-primary font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  {completeAuth.isPending ? "Connecting…" : "Submit"}
                </Button>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="w-fit text-slate-500 dark:text-slate-400"
              disabled={cancelAuth.isPending}
              onClick={() => {
                cancelAuth.mutate(undefined, { onSettled: () => startAuth.reset() });
                setCode("");
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
