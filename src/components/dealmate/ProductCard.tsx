import { effectivePrice, inr, offerFor, type Deal, type OfferRow, type ProductRow } from "@/lib/deal";

export function ProductCard({
  product,
  offers,
  rank,
  deal,
  onSelect,
}: {
  product: ProductRow;
  offers: OfferRow[];
  rank: number;
  deal: Deal | null;
  onSelect: (product: ProductRow, unitPrice: number) => void;
}) {
  const offer = offerFor(product.id, offers);
  const listPrice = effectivePrice(product, offers);
  const negotiated =
    deal && deal.product_ids.includes(product.id)
      ? Math.round(listPrice * (1 - deal.discount_pct / 100) * 100) / 100
      : null;
  const unitPrice = negotiated ?? listPrice;
  const soldOut = product.stock_count <= 0;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={() => onSelect(product, unitPrice)}
      style={{ animationDelay: `${rank * 70}ms` }}
      className="rank-in group block w-full cursor-pointer border border-border bg-surface p-0 text-left transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-[var(--shadow-card)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-surface-elevated">
        <img
          src={`https://source.unsplash.com/640x400/?${encodeURIComponent(product.category)},${encodeURIComponent(product.tags[0] ?? "product")}&sig=${product.id.slice(0, 8)}`}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        />
        <span className="label-mono absolute left-0 top-0 bg-background/85 px-2 py-1 text-gold">#{rank + 1}</span>
        {offer ? (
          <span className="label-mono absolute right-0 top-0 bg-coral px-2 py-1 text-coral-foreground">
            live −{offer.discount_pct}%
          </span>
        ) : null}
      </div>

      <div className="space-y-2.5 p-4">
        <h3 className="font-display text-base font-semibold leading-snug">{product.name}</h3>
        <div className="flex flex-wrap gap-1.5">
          {product.tags.slice(0, 3).map((t) => (
            <span key={t} className="label-mono border border-border px-1.5 py-0.5 text-muted-foreground">
              {t}
            </span>
          ))}
        </div>

        <div className="flex items-baseline gap-2">
          {negotiated != null ? (
            <>
              <span className="price-mono text-sm text-muted-foreground line-through">{inr(listPrice)}</span>
              <span className="price-mono deal-pop text-lg font-semibold text-gold">{inr(negotiated)}</span>
            </>
          ) : (
            <>
              <span className="price-mono text-lg font-semibold text-foreground">{inr(listPrice)}</span>
              {offer ? (
                <span className="price-mono text-sm text-muted-foreground line-through">{inr(product.price)}</span>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="label-mono text-muted-foreground">
            {soldOut ? "sold out" : `${product.stock_count} in stock`}
          </span>
          <span className="label-mono text-sage group-hover:text-gold">order now →</span>
        </div>
      </div>
    </button>
  );
}
