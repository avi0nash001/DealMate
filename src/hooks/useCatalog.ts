import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OfferRow, ProductRow } from "@/lib/deal";

/**
 * Catalogue + live offers, kept current through Supabase Realtime
 * (postgres_changes on products and live_offers — no polling).
 */
export function useCatalog() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from("products").select("id,name,category,price,tags,stock_count").order("price"),
      supabase.from("live_offers").select("id,product_id,discount_pct,expires_at,active"),
    ]);
    setProducts(((p ?? []) as unknown as ProductRow[]).map((r) => ({ ...r, price: Number(r.price) })));
    setOffers(((o ?? []) as unknown as OfferRow[]).map((r) => ({ ...r, discount_pct: Number(r.discount_pct) })));
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("dealmate-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "live_offers" }, () => {
        void load();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  return { products, offers, live, reload: load };
}
