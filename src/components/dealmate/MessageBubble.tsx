import { AGENT_META, inr, type ChatMessage } from "@/lib/deal";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-surface-elevated px-4 py-2.5 text-sm leading-relaxed text-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const meta = AGENT_META[message.agent ?? "preference"];

  return (
    <div className="max-w-[92%]">
      <div className={`label-mono mb-1.5 ${meta.className}`}>{meta.label}</div>
      <div className="border-l-2 border-border pl-4 text-sm leading-relaxed text-foreground">
        {message.text}
        {message.deal ? (
          <div className="deal-pop mt-2 inline-flex items-center gap-2 border border-gold/60 bg-gold/10 px-3 py-1.5">
            <span className="label-mono text-gold">
              {message.deal.kind === "bundle" ? "Bundle deal" : "Deal"} −{message.deal.discount_pct}%
            </span>
            <span className="price-mono text-sm text-muted-foreground line-through">
              {inr(message.deal.base_total)}
            </span>
            <span className="price-mono text-sm font-semibold text-gold">{inr(message.deal.final_total)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TypingIndicator({ agent }: { agent: ChatMessage["agent"] }) {
  const meta = AGENT_META[agent ?? "preference"];
  return (
    <div className="max-w-[92%]">
      <div className={`label-mono mb-1.5 ${meta.className}`}>{meta.label}</div>
      <div className="flex items-center gap-1.5 border-l-2 border-border pl-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
