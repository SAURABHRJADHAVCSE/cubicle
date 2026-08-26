import { cn } from "@/lib/utils";
import type { ConversationMessage } from "@/types/chat";

export function ChatMessage({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3.5 py-2.5 text-[11px] leading-relaxed whitespace-pre-wrap shadow-sm",
          isUser
            ? "rounded-br-xs bg-primary text-primary-foreground font-medium"
            : "rounded-bl-xs border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
