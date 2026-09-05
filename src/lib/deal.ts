// Client-safe shared types and pricing helpers.
// NOTE: seller discount limits live only in src/lib/deal.server.ts (never shipped to the client).

export type AgentKind = "preference" | "hunter" | "negotiation";

export type ChatMessage = {
  id: string;
  role: "user" | "agent";
  agent?: AgentKind;
  text: string;
  ts: string;
  deal?: Deal | null;
};

export type Deal = {
  kind: "single" | "bundle";
  product_ids: string[];
  discount_pct: number;
  /** Effective (post live-offer) total before the negotiated discount. */
  base_total: number;
  /** Negotiated total after the discount. */
  final_total: number;
  accepted: boolean;
};

export type ProductRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  tags: string[];
  stock_count: number;
  image_url?: string | null; // real product photo, when sourced from live search
};

export type OfferRow = {
  id: string;
  product_id: string;
  discount_pct: number;
  expires_at: string;
  active: boolean;
};

export type SessionState = {
  id: string;
  stage: "preference" | "hunter" | "negotiation" | "closed";
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferences: string[];
  matched_product_ids: string[];
  product_id: string | null;
  final_price: number | null;
  messages: ChatMessage[];
  created_at: string;
};

export function offerFor(productId: string, offers: OfferRow[]): OfferRow | null {
  const now = Date.now();
  const match = offers.find(
    (o) => o.product_id === productId && o.active && new Date(o.expires_at).getTime() > now,
  );
  return match ?? null;
}

export function effectivePrice(product: ProductRow, offers: OfferRow[]): number {
  const offer = offerFor(product.id, offers);
  if (!offer) return round2(product.price);
  return round2(product.price * (1 - Number(offer.discount_pct) / 100));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function inr(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}

export const AGENT_META: Record<AgentKind, { label: string; className: string }> = {
  preference: { label: "Preference Agent", className: "text-gold" },
  hunter: { label: "Deal-Hunter Agent", className: "text-sage" },
  negotiation: { label: "Negotiation Agent", className: "text-coral" },
};
