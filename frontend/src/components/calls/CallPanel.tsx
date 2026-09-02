"use client";

import { Phone, PhoneOff, Settings } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import { useUIStore } from "@/stores/uiStore";

// Substring match, not an exact-string import from the backend — good
// enough to distinguish "no voice provider configured yet" from any other
// status message (e.g. a real Sarvam error), without needing to share a
// literal string constant across the Python/TypeScript boundary.
const NOT_CONFIGURED_HINT = "not configured";

const STATE_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  ringing: "Ringing…",
  connected: "Connected",
  ended: "Call ended",
  error: "Call failed",
};

const STATE_DOT: Record<string, string> = {
  connecting: "bg-amber-400 animate-pulse",
  ringing: "bg-amber-400 animate-pulse",
  connected: "bg-emerald-400",
  ended: "bg-slate-400",
  error: "bg-rose-400",
};

export function CallPanel() {
  const activeCallAgentId = useUIStore((state) => state.activeCallAgentId);
  const selectCallAgent = useUIStore((state) => state.selectCallAgent);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const setMobileTab = useUIStore((state) => state.setMobileTab);
  const { data: agents } = useAgents();
  const agent = agents?.find((item) => item.id === activeCallAgentId);

  const { state, statusMessage, transcripts, delegation, remoteAudioRef, startCall, hangUp } =
    useVoiceCall(activeCallAgentId);
  const startedRef = useRef<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeCallAgentId && startedRef.current !== activeCallAgentId) {
      startedRef.current = activeCallAgentId;
      startCall();
    }
    if (!activeCallAgentId) startedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCallAgentId]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Once a delegation's spoken acknowledgment has actually finished
  // playing (see call:delegated's docstring — this never fires mid-
  // sentence), the call has done its job: end it and surface the task
  // feed, where the real work is now trackable, instead of leaving the
  // caller sitting in a now-pointless connected call.
  useEffect(() => {
    if (!delegation) return;
    toast.success(`Delegated to ${delegation.target_agent_name} — check the task view`);
    hangUp();
    selectCallAgent(null);
    setMobileTab("agents");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegation]);

  if (!activeCallAgentId) return null;

  function close() {
    hangUp();
    selectCallAgent(null);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/95 shadow-2xl backdrop-blur-2xl md:absolute md:inset-0 md:border-l md:border-border text-foreground">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <div className="flex items-center gap-3 border-b border-border bg-muted/90 px-4 py-3 backdrop-blur-xl">
        <Avatar className="size-8 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback className="text-2xs font-bold text-white" style={{ backgroundColor: agent?.accent_color }}>
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xs font-semibold text-foreground">
            {agent?.name ?? "Agent"}
          </p>
          <div className="flex items-center gap-1.5 text-3xs text-slate-500 dark:text-slate-400">
            <span className={`size-1.5 rounded-full ${STATE_DOT[state] ?? "bg-slate-400"}`} />
            {STATE_LABEL[state] ?? state}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
          onClick={close}
          aria-label="End call"
        >
          <PhoneOff className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4 soft-scrollbar">
        {statusMessage && (
          <div className="mx-auto flex max-w-[280px] flex-col items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-center text-2xs leading-relaxed text-primary">
            <p>{statusMessage}</p>
            {statusMessage.toLowerCase().includes(NOT_CONFIGURED_HINT) && (
              <>
                <p className="text-3xs opacity-80">
                  Add a <strong>Sarvam</strong> API key (the only voice provider Cubicle
                  supports right now) to enable real transcription and replies.
                </p>
                <Button
                  size="sm"
                  onClick={() => setSettingsOpen(true)}
                  className="h-7 rounded-full bg-primary px-3 text-3xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Settings className="size-3 mr-1" />
                  Add API key in Settings
                </Button>
              </>
            )}
          </div>
        )}

        {transcripts.length === 0 && !statusMessage && (
          <div className="mx-auto mt-10 max-w-[230px] text-center">
            <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Phone className="size-4" />
            </div>
            <p className="mt-3 text-xs font-semibold text-foreground">
              {STATE_LABEL[state] ?? "Calling…"}
            </p>
          </div>
        )}

        {transcripts.map((entry, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              entry.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-muted text-foreground"
            }`}
          >
            {entry.text}
          </div>
        ))}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}
