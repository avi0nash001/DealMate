import { useEffect, useRef } from "react";
import { MessageBubble, TypingIndicator } from "./MessageBubble";
import type { ChatMessage } from "@/lib/deal";

export function ChatLog({
  messages,
  pendingAgent,
}: {
  messages: ChatMessage[];
  pendingAgent: ChatMessage["agent"] | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, pendingAgent]);

  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {pendingAgent ? <TypingIndicator agent={pendingAgent} /> : null}
      <div ref={endRef} />
    </div>
  );
}
