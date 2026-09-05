import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCatalog } from "@/hooks/useCatalog";
import { effectivePrice, inr, offerFor } from "@/lib/deal";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Seller console — DealMate" },
      { name: "description", content: "Edit catalogue prices and stock, and toggle live offers that shoppers see instantly." },
      { property: "og:title", content: "Seller console — DealMate" },
      { property: "og:description", content: "Live offer and inventory controls for the DealMate demo retailer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { products, offers, live } = useCatalog();
  const [busy, setBusy] = useState<string | null>(null);

  async function updateProduct(id: string, patch: { price?: number; stock_count?: number }) {
    setBusy(id);
    await supabase.from("products").update(patch).eq("id", id);
    setBusy(null);
  }

  async function toggleOffer(productId: string) {
    setBusy(productId);
    const existing = offers.find((o) => o.product_id === productId);
    if (existing) {
      await supabase
        .from("live_offers")
        .update({
          active: !existing.active,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("live_offers").insert({
        product_id: productId,
        discount_pct: 10,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        active: true,
      });
    }
    setBusy(null);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl">Seller console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Price, stock and live-offer controls. Changes reach open shopping sessions instantly.
          </p>
        </div>
        <span className="label-mono flex items-center gap-1.5 text-sage">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-sage" : "bg-muted-foreground"}`} />
          {live ? "realtime on" : "connecting"}
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {products.map((p) => {
          const offer = offerFor(p.id, offers);
          const raw = offers.find((o) => o.product_id === p.id);
          return (
            <article key={p.id} className="border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg">{p.name}</h2>
                  <span className="label-mono text-muted-foreground">{p.category}</span>
                </div>
                <div className="text-right">
                  <span className="price-mono text-lg font-semibold text-gold">{inr(effectivePrice(p, offers))}</span>
                  {offer ? (
                    <div className="label-mono text-coral">live −{offer.discount_pct}%</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="label-mono text-muted-foreground">list price</span>
                  <Input
                    type="number"
                    defaultValue={p.price}
                    className="bg-surface-elevated"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v > 0 && v !== p.price) void updateProduct(p.id, { price: v });
                    }}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="label-mono text-muted-foreground">stock</span>
                  <Input
                    type="number"
                    defaultValue={p.stock_count}
                    className="bg-surface-elevated"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v >= 0 && v !== p.stock_count) void updateProduct(p.id, { stock_count: v });
                    }}
                  />
                </label>
                <div className="grid gap-1.5">
                  <span className="label-mono text-muted-foreground">
                    live offer {raw ? `(${raw.discount_pct}%)` : "(new 10%)"}
                  </span>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={Boolean(raw?.active)}
                      disabled={busy === p.id}
                      onCheckedChange={() => void toggleOffer(p.id)}
                    />
                    <span className="label-mono text-muted-foreground">
                      {raw?.active ? "active" : "off"}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="label-mono mt-6 text-muted-foreground"
        onClick={() => window.location.reload()}
      >
        refresh view
      </Button>
    </main>
  );
}
