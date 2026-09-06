import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ChatLog } from "@/components/dealmate/ChatLog";
import { ProductGrid } from "@/components/dealmate/ProductGrid";
import { AgentSidebar } from "@/components/dealmate/AgentSidebar";
import { OrderModal } from "@/components/dealmate/OrderModal";
import { useCatalog } from "@/hooks/useCatalog";
import { getOrCreateSession, sendChat, startNewSession } from "@/lib/session.functions";
import { effectivePrice, type ChatMessage, type ProductRow, type SessionState } from "@/lib/deal";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Negotiation session — DealMate" },
      {
        name: "description",
        content: "Chat with DealMate's Preference, Deal-Hunter and Negotiation agents and order at your negotiated price.",
      },
      { property: "og:title", content: "Negotiation session — DealMate" },
      { property: "og:description", content: "Live AI negotiation on real products with live offer pricing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatSessionView,
});

function ChatSessionView() {
  const start = useServerFn(getOrCreateSession);
  const reset = useServerFn(startNewSession);
  const send = useServerFn(sendChat);

  const { products, offers, live, reload } = useCatalog();
  const [session, setSession] = useState<SessionState | null>(null);
  const [pending, setPending] = useState<ChatMessage["agent"] | null>(null);
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [orderTarget, setOrderTarget] = useState<{ product: ProductRow; unitPrice: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    start({})
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled) setSessionError("We couldn't open your session. Please refresh or sign in again.");
      });
    return () => {
      cancelled = true;
    };
  }, [start]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [pending, session?.id]);

  const matched = session
    ? session.matched_product_ids
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is ProductRow => Boolean(p))
    : [];

  const deal =
    session
      ? ([...session.messages].reverse().find((m) => m.deal)?.deal ?? null)
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !session || pending) return;

    setInput("");
    setOptimistic([
      { id: `tmp-${Date.now()}`, role: "user", text, ts: new Date().toISOString() },
    ]);
    setPending(session.stage === "preference" ? "preference" : "negotiation");

    try {
      const next = await send({ data: { sessionId: session.id, text } });
      await reload(); // pick up any newly live-searched products immediately, don't wait on realtime
      setSession(next);
    } finally {
      setOptimistic([]);
      setPending(null);
    }
  }

  if (!session) {
    return (
      <div className="flex h-[70vh] items-center justify-center px-4 text-center">
        <span className="label-mono text-muted-foreground">
          {sessionError ?? "opening your session…"}
        </span>
      </div>
    );
  }

  const messages = [...session.messages, ...optimistic];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
        {/* Chat panel */}
        <section className="flex h-[70vh] min-h-[520px] flex-col border border-border bg-surface lg:h-[calc(100vh-9rem)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <span className="label-mono text-muted-foreground">negotiation chat</span>
            <Button
              variant="ghost"
              size="sm"
              className="label-mono text-muted-foreground hover:text-foreground"
              onClick={async () => {
                setOrderTarget(null);
                setSession(await reset({}));
              }}
            >
              new session
            </Button>
          </div>

          <ChatLog messages={messages} pendingAgent={pending} />

          <form onSubmit={submit} className="flex gap-2 border-t border-border p-3 sm:p-4">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={session.stage === "negotiation" ? "Push back on the price…" : "Type your reply…"}
              className="min-w-0 flex-1 border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            />
            <Button
              type="submit"
              disabled={!input.trim() || pending != null}
              className="bg-gold text-gold-foreground hover:bg-gold/90"
            >
              Send
            </Button>
          </form>
        </section>

        {/* Grid + sidebar */}
        <section className="space-y-6 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto">
          <AgentSidebar session={session} live={live} />
          <ProductGrid
            products={matched}
            offers={offers}
            deal={deal}
            onSelect={(product, unitPrice) => setOrderTarget({ product, unitPrice })}
          />
        </section>
      </div>

      <OrderModal
        product={orderTarget?.product ?? null}
        unitPrice={orderTarget?.unitPrice ?? (orderTarget ? effectivePrice(orderTarget.product, offers) : 0)}
        sessionId={session.id}
        onClose={() => setOrderTarget(null)}
        onPlaced={() => void reload()}
      />
    </main>
  );
}
