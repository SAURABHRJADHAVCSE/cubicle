import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/types/chat";

export function ChatMessage({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap shadow-sm",
          isUser
            ? "rounded-br-md bg-[#5b5cf0] text-white"
            : "rounded-bl-md border border-[#e7eaf0] bg-white text-[#465268]",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
