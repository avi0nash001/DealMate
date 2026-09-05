import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrders, listSessions } from "@/lib/session.functions";
import { inr } from "@/lib/deal";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Your orders & sessions — DealMate" },
      { name: "description", content: "Every DealMate order you placed and every negotiation session you ran." },
      { property: "og:title", content: "Your orders & sessions — DealMate" },
      { property: "og:description", content: "Order history and past AI negotiation sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const fetchOrders = useServerFn(listOrders);
  const fetchSessions = useServerFn(listSessions);

  const orders = useQuery({ queryKey: ["orders"], queryFn: () => fetchOrders({}) });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => fetchSessions({}) });

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl">Your orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Real order records with the price you negotiated.</p>

        <div className="mt-6 space-y-3">
          {orders.isLoading ? <Empty text="loading orders…" /> : null}
          {orders.data?.length === 0 ? <Empty text="No orders yet — go negotiate one." /> : null}
          {orders.data?.map((o) => (
            <article key={o.id} className="border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg">{o.products?.name ?? "Product"}</h2>
                <span className="price-mono text-lg font-semibold text-gold">
                  {inr(Number(o.negotiated_price) * o.quantity)}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="price-mono">
                  {o.quantity} × {inr(Number(o.negotiated_price))}
                </span>
                <span className="label-mono text-sage">{o.status}</span>
                <span>{o.delivery_address}</span>
                <span className="price-mono text-xs">
                  {new Date(o.created_at).toLocaleString("en-IN")} · id {o.id.slice(0, 8)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl">Past sessions</h2>
        <div className="mt-4 divide-y divide-border border border-border bg-surface">
          {sessions.data?.length === 0 ? <Empty text="No sessions yet." /> : null}
          {sessions.data?.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <span className="label-mono text-gold">{s.category ?? "unspecified"}</span>
                <div className="mt-1 text-muted-foreground">
                  {s.budget_min || s.budget_max
                    ? `${inr(Number(s.budget_min ?? 0))} – ${inr(Number(s.budget_max ?? 0))}`
                    : "no budget captured"}
                  {s.preferences.length ? ` · ${s.preferences.join(", ")}` : ""}
                </div>
              </div>
              <div className="text-right">
                <span className="label-mono text-muted-foreground">{s.stage}</span>
                <div className="price-mono text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("en-IN")}
                  {s.final_price ? ` · ${inr(Number(s.final_price))}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="label-mono border border-dashed border-border p-6 text-muted-foreground">{text}</p>;
}
