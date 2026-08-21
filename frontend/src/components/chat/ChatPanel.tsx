"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

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
  const selectedAgentId = useUIStore((s) => s.selectedAgentId);
  const selectAgent = useUIStore((s) => s.selectAgent);
  const { data: agents } = useAgents();
  const agent = agents?.find((a) => a.id === selectedAgentId);

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
    <div className="fixed inset-0 z-40 flex flex-col bg-background md:static md:z-auto md:h-full md:w-80 md:shrink-0 md:border-l">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Avatar className="size-7" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback
            style={{ backgroundColor: agent?.accent_color, color: "white" }}
            className="text-xs"
          >
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-heading text-sm font-medium">{agent?.name ?? "Agent"}</p>
          <p className="text-xs text-muted-foreground">{agent?.role}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => selectAgent(null)} aria-label="Close chat">
          <X className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        <div className="flex flex-col gap-2">
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

      <div className="flex gap-2 border-t p-3">
        <Input
          placeholder={`Message ${agent?.name ?? "agent"}…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button size="sm" onClick={handleSend} disabled={!draft.trim() || sendMessage.isPending}>
          Send
        </Button>
      </div>
    </div>
  );
}
