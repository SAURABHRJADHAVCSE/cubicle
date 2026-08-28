"use client";

import { Phone, PhoneOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/useAgents";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import { useUIStore } from "@/stores/uiStore";

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
  const { data: agents } = useAgents();
  const agent = agents?.find((item) => item.id === activeCallAgentId);

  const { state, statusMessage, transcripts, remoteAudioRef, startCall, hangUp } =
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

  if (!activeCallAgentId) return null;

  function close() {
    hangUp();
    selectCallAgent(null);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white/95 dark:bg-slate-950/95 shadow-2xl backdrop-blur-2xl md:absolute md:inset-0 md:border-l md:border-slate-200 dark:md:border-white/10 text-slate-900 dark:text-slate-100">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/80 px-4 py-3 backdrop-blur-xl">
        <Avatar className="size-8 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback className="text-2xs font-bold text-white" style={{ backgroundColor: agent?.accent_color }}>
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xs font-semibold text-slate-900 dark:text-slate-100">
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
          <div className="mx-auto max-w-[280px] rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-center text-2xs leading-relaxed text-primary">
            {statusMessage}
          </div>
        )}

        {transcripts.length === 0 && !statusMessage && (
          <div className="mx-auto mt-10 max-w-[230px] text-center">
            <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Phone className="size-4" />
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-900 dark:text-slate-200">
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
                : "mr-auto bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
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
