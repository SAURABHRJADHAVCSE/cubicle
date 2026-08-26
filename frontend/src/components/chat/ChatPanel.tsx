"use client";

import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ChatMessage } from "@/components/chat/ChatMessage";
import { TypingIndicator } from "@/components/common/Indicators";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAgents } from "@/hooks/useAgents";
import { useConversations, useSendChatMessage } from "@/hooks/useChat";
import { useChatStream } from "@/hooks/useChatStream";
import { useUIStore } from "@/stores/uiStore";

export function ChatPanel() {
  const selectedAgentId = useUIStore((state) => state.selectedAgentId);
  const selectAgent = useUIStore((state) => state.selectAgent);
  const { data: agents } = useAgents();
  const agent = agents?.find((item) => item.id === selectedAgentId);

  const { data: history } = useConversations(selectedAgentId);
  const sendMessage = useSendChatMessage(selectedAgentId);
  const streamingText = useChatStream(selectedAgentId);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamingText]);

  if (!selectedAgentId) return null;

  function handleSend() {
    const message = draft.trim();
    if (!message) return;
    setDraft("");
    sendMessage.mutate(message);
  }

  const waitingForFirstToken = sendMessage.isPending && !streamingText;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white/95 dark:bg-slate-950/95 shadow-2xl backdrop-blur-2xl md:absolute md:inset-y-0 md:right-0 md:w-[92%] md:max-w-[380px] md:border-l md:border-slate-200 dark:md:border-white/10 text-slate-900 dark:text-slate-100">
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/80 px-4 py-3 backdrop-blur-xl">
        <Avatar className="size-8 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback
            className="text-[11px] font-bold text-white"
            style={{ backgroundColor: agent?.accent_color }}
          >
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-heading text-xs font-semibold text-slate-900 dark:text-slate-100">{agent?.name ?? "Agent"}</p>
            <span className="size-1.5 rounded-full bg-success" />
          </div>
          <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">Direct line · {agent?.role}</p>
        </div>
        <div className="mr-1 hidden items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary sm:flex">
          <Sparkles className="size-2.5" /> AI
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
          onClick={() => selectAgent(null)}
          aria-label="Close chat"
        >
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-4 soft-scrollbar">
        <div className="flex flex-col gap-2.5">
          {history?.length === 0 && !streamingText && (
            <div className="mx-auto mt-10 max-w-[230px] text-center">
              <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-900 dark:text-slate-200">Start a conversation</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                Ask for an update, discuss a task, or give {agent?.name ?? "this agent"} a new instruction.
              </p>
            </div>
          )}
          {history?.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {streamingText && (
            <ChatMessage
              message={{
                id: "streaming",
                agent_id: selectedAgentId,
                role: "agent",
                content: streamingText,
                message_type: "chat",
                created_at: new Date().toISOString(),
              }}
            />
          )}
          {waitingForFirstToken && <TypingIndicator />}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/90 p-3 backdrop-blur-xl">
        <div className="flex gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 pl-3 shadow-inner">
          <Input
            className="h-8 flex-1 border-0 bg-transparent px-0 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-none focus-visible:ring-0"
            placeholder={`Message ${agent?.name ?? "agent"}…`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
          />
          <Button
            size="icon-sm"
            className="rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            onClick={handleSend}
            disabled={!draft.trim() || sendMessage.isPending}
            aria-label="Send message"
          >
            <Send className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
