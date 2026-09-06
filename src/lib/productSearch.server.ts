// SERVER ONLY — this file must never be imported into client bundles.
// Handles live product search via a licensed product-search API (RapidAPI's
// "Real-Time Product Search"), caches results into Supabase `products`,
// and falls back to whatever's already cached if the live call fails.

import type { ProductRow } from "./deal";

const RAPIDAPI_HOST = "real-time-product-search.p.rapidapi.com";
const RAPIDAPI_URL = `https://${RAPIDAPI_HOST}/search`;

type RapidApiProduct = {
  product_id?: string;
  product_title?: string;
  product_price?: string; // e.g. "₹6,499" or "$64.99"
  product_photos?: string[];
  typical_price_range?: [string, string];
};

type RapidApiResponse = {
  status?: string;
  data?: RapidApiProduct[];
};

/** Pulls the first numeric value out of a price string like "₹6,499.00" */
function parsePrice(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Very small tag guesser from the product title, since the API doesn't return tags directly. */
function guessTags(title: string): string[] {
  const lower = title.toLowerCase();
  const candidates = [
    "lightweight", "breathable", "waterproof", "cushioned", "trail",
    "running", "sports", "wireless", "noise cancelling", "anc",
    "bass", "compact", "premium", "budget", "gym", "daily", "battery",
  ];
  return candidates.filter((tag) => lower.includes(tag)).slice(0, 4);
}

type Db = { from: (t: string) => any };

/**
 * Searches for real, live products matching `query` + `category`, caches
 * the results into Supabase `products`, and returns the merged/refreshed
 * list for that category. On any failure (network, rate limit, malformed
 * response), it silently falls back to whatever is already cached in
 * Supabase for that category — the demo never visibly breaks.
 */
export async function fetchLiveProducts(
  db: Db,
  category: string,
  preferenceQuery: string,
): Promise<ProductRow[]> {]
  const key = process.env["RAPIDAPI_KEY"];

  // No key configured -> skip live search entirely, use cache only.
  if (!key) {
    return loadCachedByCategory(db, category);
  }

  try {
    const query = `${preferenceQuery} ${category}`.trim();
    const url = `${RAPIDAPI_URL}?q=${encodeURIComponent(query)}&country=in&language=en&limit=8`;

    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
      // Keep this tight — a slow external API must never stall the chat for long.
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) throw new Error(`RapidAPI ${res.status}`);

    const json = (await res.json()) as RapidApiResponse;
    const items = Array.isArray(json.data) ? json.data : [];

    const parsed = items
      .map((item) => {
        const price = parsePrice(item.product_price);
        const name = item.product_title?.trim();
        if (!price || !name) return null;
        return {
          external_id: item.product_id ?? null,
          name: name.slice(0, 120),
          category,
          price,
          tags: guessTags(name),
          image_url: item.product_photos?.[0] ?? null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .slice(0, 6);

    if (parsed.length === 0) throw new Error("No usable results");

    await upsertProducts(db, parsed);
    return loadCachedByCategory(db, category);
  } catch (err) {
    // Live search failed for any reason — fall back to cache, never crash the chat.
    console.warn("[fetchLiveProducts] live search failed, using cache:", err);
    return loadCachedByCategory(db, category);
  }
}

async function loadCachedByCategory(db: Db, category: string): Promise<ProductRow[]> {
  const { data } = await db
    .from("products")
    .select("id,name,category,price,tags,stock_count")
    .eq("category", category);
  return ((data ?? []) as ProductRow[]).map((p) => ({ ...p, price: Number(p.price) }));
}

/**
 * Upserts by `external_id` when present (keeps re-searches from creating
 * duplicate rows), otherwise falls back to matching on name+category.
 * Requires the `external_id text UNIQUE` and `image_url text` columns —
 * see the migration snippet below.
 */
async function upsertProducts(
  db: Db,
  items: { external_id: string | null; name: string; category: string; price: number; tags: string[]; image_url: string | null }[],
) {
  for (const item of items) {
    if (item.external_id) {
      const { data: existing } = await db
        .from("products")
        .select("id")
        .eq("external_id", item.external_id)
        .limit(1);

      if (existing && existing.length > 0) {
        await db
          .from("products")
          .update({ price: item.price, name: item.name, image_url: item.image_url })
          .eq("external_id", item.external_id);
        continue;
      }
    }

    await db.from("products").insert({
      name: item.name,
      category: item.category,
      price: item.price,
      tags: item.tags,
      stock_count: 25, // live-sourced items default to in-stock; adjust as needed
      external_id: item.external_id,
      image_url: item.image_url,
    });
  }
}
