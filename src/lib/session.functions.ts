import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { effectivePrice, round2, type ChatMessage, type Deal, type OfferRow, type ProductRow, type SessionState } from "./deal";
import { clampDeal, rankMatches, runNegotiationAgent, runPreferenceAgent } from "./deal.server";

function msg(partial: Omit<ChatMessage, "id" | "ts">): ChatMessage {
  return { id: crypto.randomUUID(), ts: new Date().toISOString(), ...partial };
}

type Db = { from: (t: string) => any };

async function loadCatalog(db: Db): Promise<{ products: ProductRow[]; offers: OfferRow[] }> {
  const [{ data: products }, { data: offers }] = await Promise.all([
    db.from("products").select("id,name,category,price,tags,stock_count"),
    db.from("live_offers").select("id,product_id,discount_pct,expires_at,active").eq("active", true),
  ]);
  return {
    products: ((products ?? []) as ProductRow[]).map((p) => ({ ...p, price: Number(p.price) })),
    offers: ((offers ?? []) as OfferRow[]).map((o) => ({ ...o, discount_pct: Number(o.discount_pct) })),
  };
}

function toSession(row: Record<string, unknown>): SessionState {
  return {
    id: String(row['id']),
    stage: row['stage'] as SessionState["stage"],
    category: (row['category'] as string | null) ?? null,
    budget_min: row['budget_min'] != null ? Number(row['budget_min']) : null,
    budget_max: row['budget_max'] != null ? Number(row['budget_max']) : null,
    preferences: (row['preferences'] as string[]) ?? [],
    matched_product_ids: (row['matched_product_ids'] as string[]) ?? [],
    product_id: (row['product_id'] as string | null) ?? null,
    final_price: row['final_price'] != null ? Number(row['final_price']) : null,
    messages: (row['messages'] as ChatMessage[]) ?? [],
    created_at: String(row['created_at']),
  };
}

const SESSION_COLS =
  "id,stage,category,budget_min,budget_max,preferences,matched_product_ids,product_id,final_price,messages,created_at";

/** Returns the shopper's open session, creating one (with the opening question) if needed. */
export const getOrCreateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;

    const { data: existing } = await db
      .from("negotiation_sessions")
      .select(SESSION_COLS)
      .neq("stage", "closed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) return toSession(existing[0]);

    const opening = msg({
      role: "agent",
      agent: "preference",
      text: "Hi — I'm DealMate. To find you a real deal fast: what are you shopping for today, running shoes or earbuds?",
    });

    const { data, error } = await db
      .from("negotiation_sessions")
      .insert({ user_id: context.userId, messages: [opening] })
      .select(SESSION_COLS)
      .single();

    if (error) throw new Error(error.message);
    return toSession(data);
  });

export const startNewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    await db.from("negotiation_sessions").update({ stage: "closed" }).neq("stage", "closed");

    const opening = msg({
      role: "agent",
      agent: "preference",
      text: "Fresh session. What are you shopping for — running shoes or earbuds?",
    });
    const { data, error } = await db
      .from("negotiation_sessions")
      .insert({ user_id: context.userId, messages: [opening] })
      .select(SESSION_COLS)
      .single();
    if (error) throw new Error(error.message);
    return toSession(data);
  });

const SendInput = z.object({ sessionId: z.string().uuid(), text: z.string().min(1).max(600) });

export const sendChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }): Promise<SessionState> => {
    const db = context.supabase as unknown as Db;

    const { data: row, error } = await db
      .from("negotiation_sessions")
      .select(SESSION_COLS)
      .eq("id", data.sessionId)
      .single();
    if (error || !row) throw new Error("Session not found");

    const session = toSession(row);
    const messages: ChatMessage[] = [...session.messages, msg({ role: "user", text: data.text })];

    const { products, offers } = await loadCatalog(db);
    const effective: Record<string, number> = {};
    for (const p of products) effective[p.id] = effectivePrice(p, offers);

    const patch: Record<string, unknown> = {};

    try {
      if (session.stage === "preference") {
        const categories = Array.from(new Set(products.map((p) => p.category)));
        const pref = await runPreferenceAgent(messages, categories, {
          category: session.category,
          budget_min: session.budget_min,
          budget_max: session.budget_max,
          preferences: session.preferences,
        });

        patch['category'] = pref.category ?? session.category;
        patch['budget_min'] = pref.budget_min ?? session.budget_min;
        patch['budget_max'] = pref.budget_max ?? session.budget_max;
        patch['preferences'] = pref.preferences.length ? pref.preferences : session.preferences;
        messages.push(msg({ role: "agent", agent: "preference", text: pref.reply }));

        if (pref.complete) {
          const category = String(patch['category']);

          // Pull real, live products for this category (cached into Supabase,
          // falls back silently to whatever's cached if the live search fails).
          const { fetchLiveProducts } = await import("./productSearch.server");
          const liveProducts = await fetchLiveProducts(
            db,
            category,
            (patch['preferences'] as string[]).join(" "),
          );
          // New live products won't be in `effective` yet (it was built from
          // the catalog loaded before this search) — fill in the gaps.
          for (const p of liveProducts) {
            if (!(p.id in effective)) effective[p.id] = effectivePrice(p, offers);
          }

          const matched = rankMatches(
            liveProducts,
            {
              budget_min: patch['budget_min'] as number | null,
              budget_max: patch['budget_max'] as number | null,
              preferences: patch['preferences'] as string[],
              effective,
            },
          );

          if (matched.length === 0) {
            patch['stage'] = "preference";
            messages.push(
              msg({
                role: "agent",
                agent: "hunter",
                text: "Nothing in stock lands inside that budget. Give me a slightly wider range and I'll search again.",
              }),
            );
          } else {
            patch['matched_product_ids'] = matched.map((m) => m.id);
            messages.push(
              msg({
                role: "agent",
                agent: "hunter",
                text: `Found ${matched.length} strong matches and pulled today's live offers into the prices. Top pick: ${matched[0]!.name}.`,
              }),
            );

            const neg = await runNegotiationAgent({
              history: messages,
              products: matched.map((m) => ({
                id: m.id,
                name: m.name,
                effective_price: effective[m.id]!,
                tags: m.tags,
              })),
              currentDeal: null,
              opening: true,
            });
            const deal = clampDeal(neg, matched, effective, null);
            patch['stage'] = "negotiation";
            messages.push(msg({ role: "agent", agent: "negotiation", text: neg.reply, deal }));
          }
        }
      } else if (session.stage === "negotiation") {
        const matched = products.filter((p) => session.matched_product_ids.includes(p.id));
        const currentDeal =
          [...session.messages].reverse().find((m) => m.deal)?.deal ?? null;

        const neg = await runNegotiationAgent({
          history: messages,
          products: matched.map((m) => ({
            id: m.id,
            name: m.name,
            effective_price: effective[m.id]!,
            tags: m.tags,
          })),
          currentDeal,
          opening: false,
        });

        const deal = clampDeal(neg, matched, effective, currentDeal);
        messages.push(msg({ role: "agent", agent: "negotiation", text: neg.reply, deal }));

        if (deal?.accepted) {
          patch['final_price'] = deal.final_total;
          patch['product_id'] = deal.kind === "single" ? deal.product_ids[0] : null;
        }
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      const text =
        status === 402
          ? "I've hit my usage limit for now — the shop owner needs to top up AI credits before I can keep negotiating."
          : status === 429
            ? "Too many requests at once. Give me a few seconds and say that again."
            : "I lost my train of thought there. Could you say that once more?";
      messages.push(msg({ role: "agent", agent: session.stage === "preference" ? "preference" : "negotiation", text }));
    }

    patch['messages'] = messages;
    patch['updated_at'] = new Date().toISOString();

    const { data: updated, error: upErr } = await db
      .from("negotiation_sessions")
      .update(patch)
      .eq("id", session.id)
      .select(SESSION_COLS)
      .single();
    if (upErr) throw new Error(upErr.message);
    return toSession(updated);
  });

const OrderInput = z.object({
  productId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  quantity: z.number().int().min(1).max(10),
  deliveryAddress: z.string().min(8).max(400),
});

export const placeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db & { rpc: (n: string, a: unknown) => any };

    // Price is recomputed server-side from the stored session deal — never trusted from the client.
    const { products, offers } = await loadCatalog(db);
    const product = products.find((p) => p.id === data.productId);
    if (!product) throw new Error("Product not found");

    let unitPrice = effectivePrice(product, offers);

    if (data.sessionId) {
      const { data: row } = await db
        .from("negotiation_sessions")
        .select(SESSION_COLS)
        .eq("id", data.sessionId)
        .single();
      if (row) {
        const session = toSession(row);
        const deal = [...session.messages].reverse().find((m) => m.deal)?.deal ?? null;
        if (deal && deal.product_ids.includes(product.id)) {
          unitPrice = round2(unitPrice * (1 - deal.discount_pct / 100));
        }
      }
    }

    const { data: order, error } = await (db as any).rpc("place_order", {
      _product_id: data.productId,
      _quantity: data.quantity,
      _negotiated_price: unitPrice,
      _delivery_address: data.deliveryAddress,
      _session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);

    const placed = Array.isArray(order) ? order[0] : order;
    return {
      id: String(placed.id),
      quantity: Number(placed.quantity),
      unit_price: Number(placed.negotiated_price),
      total: round2(Number(placed.negotiated_price) * Number(placed.quantity)),
      product_name: product.name,
      created_at: String(placed.created_at),
    };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data, error } = await db
      .from("orders")
      .select("id,quantity,negotiated_price,delivery_address,status,created_at,products(name,category)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      quantity: number;
      negotiated_price: number;
      delivery_address: string;
      status: string;
      created_at: string;
      products: { name: string; category: string } | null;
    }[];
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data, error } = await db
      .from("negotiation_sessions")
      .select("id,stage,category,budget_min,budget_max,preferences,final_price,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      stage: string;
      category: string | null;
      budget_min: number | null;
      budget_max: number | null;
      preferences: string[];
      final_price: number | null;
      created_at: string;
    }[];
  });
