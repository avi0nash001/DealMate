import { useState } from "react";
import { ProductCard } from "./ProductCard";
import { effectivePrice, type Deal, type OfferRow, type ProductRow } from "@/lib/deal";

type SortKey = "rank" | "price-asc" | "price-desc";

export function ProductGrid({
  products,
  offers,
  deal,
  onSelect,
}: {
  products: ProductRow[];
  offers: OfferRow[];
  deal: Deal | null;
  onSelect: (product: ProductRow, unitPrice: number) => void;
}) {
  const [sort, setSort] = useState<SortKey>("rank");

  if (products.length === 0) {
    return (
      <div className="border border-dashed border-border bg-surface/60 p-6 text-sm text-muted-foreground">
        Matched products will appear here once the Deal-Hunter has your brief.
      </div>
    );
  }

  const sorted = [...products];
  if (sort !== "rank") {
    sorted.sort((a, b) => {
      const pa = effectivePrice(a, offers);
      const pb = effectivePrice(b, offers);
      return sort === "price-asc" ? pa - pb : pb - pa;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="label-mono text-muted-foreground">matched products</span>
        <div className="flex gap-1">
          {(
            [
              ["rank", "rank"],
              ["price-asc", "₹ low"],
              ["price-desc", "₹ high"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`label-mono border px-2 py-1 transition-colors ${
                sort === key
                  ? "border-gold text-gold"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {sorted.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            offers={offers}
            rank={products.findIndex((x) => x.id === p.id) === -1 ? i : products.findIndex((x) => x.id === p.id)}
            deal={deal}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
