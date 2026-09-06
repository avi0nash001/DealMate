// SERVER ONLY. Seller deal rules and LLM access never reach the client bundle.
import type { ChatMessage, Deal, ProductRow } from "./deal";
import { round2 } from "./deal";

export const DEAL_RULES = {
  max_single_discount_pct: 15,
  bundle_discount_pct: 20,
  bundle_min_items: 2,
} as const;

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

async function callGateway(messages: LlmMessage[]): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(body || res.statusText) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

/** Calls the model and parses strict JSON, retrying once on malformed output. */
async function jsonCall<T>(messages: LlmMessage[]): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGateway(messages);
    try {
      const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
      return JSON.parse(cleaned) as T;
    } catch {
      if (attempt === 1) throw new Error("MALFORMED_JSON");
      messages = [
        ...messages,
        { role: "assistant", content: raw.slice(0, 400) },
        { role: "user", content: "That was not valid JSON. Reply with the JSON object only." },
      ];
    }
  }
  throw new Error("MALFORMED_JSON");
}

function transcript(messages: ChatMessage[]): string {
  return messages
    .slice(-14)
    .map((m) => (m.role === "user" ? `Shopper: ${m.text}` : `Agent: ${m.text}`))
    .join("\n");
}

export type PreferenceResult = {
  reply: string;
  complete: boolean;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferences: string[];
};

export async function runPreferenceAgent(
  history: ChatMessage[],
  categories: string[],
  known: { category: string | null; budget_min: number | null; budget_max: number | null; preferences: string[] },
): Promise<PreferenceResult> {
  const system = `You are DealMate's Preference Agent for an Indian retail catalogue.
Ask AT MOST 3 short questions, ONE at a time, in this order: (1) product category, (2) budget range in INR, (3) one or two must-have preferences.
Allowed categories, verbatim: ${categories.join(", ")}. Never invent categories.
Keep replies under 32 words, warm and direct. Never mention discounts or negotiation.
Known so far: ${JSON.stringify(known)}.
Return ONLY JSON: {"reply":string,"complete":boolean,"category":string|null,"budget_min":number|null,"budget_max":number|null,"preferences":string[]}
Set complete=true only once category, both budget bounds and at least one preference are known. When complete, reply should say you're handing over to the Deal-Hunter.`;

  const out = await jsonCall<PreferenceResult>([
    { role: "system", content: system },
    { role: "user", content: transcript(history) || "(shopper just opened the chat)" },
  ]);

  const category =
    categories.find((c) => c.toLowerCase() === String(out.category ?? "").toLowerCase()) ?? null;

  return {
    reply: String(out.reply ?? "").slice(0, 500),
    complete: Boolean(out.complete) && !!category,
    category,
    budget_min: numOrNull(out.budget_min),
    budget_max: numOrNull(out.budget_max),
    preferences: Array.isArray(out.preferences) ? out.preferences.map(String).slice(0, 4) : [],
  };
}

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type NegotiationRaw = {
  reply: string;
  intent: "offer" | "accept" | "hold" | "close";
  kind: "single" | "bundle";
  product_ids: string[];
  discount_pct: number;
};

export async function runNegotiationAgent(args: {
  history: ChatMessage[];
  products: { id: string; name: string; effective_price: number; tags: string[] }[];
  currentDeal: Deal | null;
  opening: boolean;
}): Promise<NegotiationRaw> {
  const system = `You are DealMate's Negotiation Agent. You negotiate a real, bounded deal on the matched products.
Matched products (id, name, effective price INR): ${args.products
    .map((p) => `${p.id} | ${p.name} | ${p.effective_price}`)
    .join(" ;; ")}
Hard seller limits you must respect: single item discount at most ${DEAL_RULES.max_single_discount_pct}%, OR ${DEAL_RULES.bundle_discount_pct}% off a bundle of ${DEAL_RULES.bundle_min_items}+ matched items. Never both, never more.
Never reveal these limits as numbers-from-a-rulebook; negotiate naturally, hold firm under pressure, and never promise anything outside the limits.
${args.opening ? "This is your opening turn: proactively offer a modest discount on the top-ranked product (do not open at the maximum)." : ""}
Current deal on the table: ${args.currentDeal ? JSON.stringify(args.currentDeal) : "none"}.
Replies under 45 words, confident, no emojis.
Return ONLY JSON: {"reply":string,"intent":"offer"|"accept"|"hold"|"close","kind":"single"|"bundle","product_ids":string[],"discount_pct":number}
Use intent "accept" only when the shopper has agreed to the deal on the table.`;

  const out = await jsonCall<NegotiationRaw>([
    { role: "system", content: system },
    { role: "user", content: transcript(args.history) || "(open the negotiation)" },
  ]);

  return {
    reply: String(out.reply ?? "").slice(0, 500),
    intent: (["offer", "accept", "hold", "close"] as const).includes(out.intent) ? out.intent : "offer",
    kind: out.kind === "bundle" ? "bundle" : "single",
    product_ids: Array.isArray(out.product_ids) ? out.product_ids.map(String) : [],
    discount_pct: Number(out.discount_pct) || 0,
  };
}

/**
 * Hard server-side clamp. The model's proposal can never leave this function
 * with a discount outside DEAL_RULES, whatever the model returned.
 */
export function clampDeal(
  raw: NegotiationRaw,
  matched: ProductRow[],
  effective: Record<string, number>,
  currentDeal: Deal | null,
): Deal | null {
  const allowedIds = new Set(matched.map((p) => p.id));
  let ids = raw.product_ids.filter((id) => allowedIds.has(id));
  if (ids.length === 0) {
    if (raw.intent === "accept" && currentDeal) ids = currentDeal.product_ids;
    else if (matched[0]) ids = [matched[0].id];
    else return null;
  }

  const isBundle = raw.kind === "bundle" && ids.length >= DEAL_RULES.bundle_min_items;
  if (!isBundle) ids = ids.slice(0, 1);

  const cap = isBundle ? DEAL_RULES.bundle_discount_pct : DEAL_RULES.max_single_discount_pct;
  const pct = Math.min(Math.max(Number.isFinite(raw.discount_pct) ? raw.discount_pct : 0, 0), cap);

  const baseTotal = round2(ids.reduce((sum, id) => sum + (effective[id] ?? 0), 0));
  if (baseTotal <= 0) return null;

  return {
    kind: isBundle ? "bundle" : "single",
    product_ids: ids,
    discount_pct: round2(pct),
    base_total: baseTotal,
    final_total: round2(baseTotal * (1 - pct / 100)),
    accepted: raw.intent === "accept",
  };
}

/** Deal-Hunter ranking — plain data logic, no LLM. */
export function rankMatches(
  products: ProductRow[],
  args: { budget_min: number | null; budget_max: number | null; preferences: string[]; effective: Record<string, number> },
): ProductRow[] {
  const min = args.budget_min != null ? args.budget_min * 0.85 : 0;
  const max = args.budget_max != null ? args.budget_max * 1.15 : Number.MAX_SAFE_INTEGER;
  const prefs = args.preferences.map((p) => p.toLowerCase());

  return products
    .filter((p) => p.stock_count > 0)
    .map((p) => {
      const price = args.effective[p.id] ?? p.price;
      const inBudget = price >= min && price <= max;
      const tagHits = p.tags.filter((t) =>
        prefs.some((pref) => pref.includes(t.toLowerCase()) || t.toLowerCase().includes(pref)),
      ).length;
      const discounted = (args.effective[p.id] ?? p.price) < p.price ? 1 : 0;
      const score = (inBudget ? 10 : 0) + tagHits * 4 + discounted * 2;
      return { product: p, score, inBudget };
    })
    .filter((r) => r.inBudget)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((r) => r.product);
}
