# DealMate AI

FINAL WEBSITE GENERATION PROMPT

---

**ROLE DEFINITION**

You are a senior full-stack engineer and senior product designer working together to build a production-grade web application in a single build session. You write clean, modular, deployable code and make deliberate UX decisions — no placeholder content, no "lorem ipsum," no generic component names. Every decision must be justified by the product's actual purpose: a real-time, agentic AI negotiation experience that ends in an actual order being placed.

---

**PRODUCT DEFINITION**

Business Name: DealMate

Industry: Retail / E-commerce (AI-enabled conversational commerce)

Main Problem: Standard e-commerce recommendation engines suggest products but do not replicate real shopping behavior — comparing options, asking for a better deal, or bundling items for a discount. Shoppers either overpay or abandon carts due to the lack of a dynamic, conversational path to a personalized deal.

Solution: A multi-agent AI shopping assistant that conversationally learns shopper intent, finds relevant matched products in real time, negotiates a genuine bounded discount or bundle deal inside the chat, and lets the shopper place a real order on the negotiated price without leaving the conversation.

Target Users: Registered online shoppers browsing a retail catalog who want a faster, more personalized path to a good deal and a direct route to purchase.

Core Feature: Three sequential, specialized AI agents (Preference Agent, Deal-Hunter Agent, Negotiation Agent) operating as one continuous conversational flow, backed by a real product/offer database with live discount updates, ending in a real, order-placing checkout action.

USP: The negotiation is real, not scripted — pricing updates live within seller-defined limits on visual product cards, and the shopper can act on the negotiated price immediately by placing an order, all inside one authenticated session.

Backend / Automation Setup: Supabase (Postgres + Auth + Realtime + Edge Functions) for data, authentication, and agent orchestration; LLM API calls (Claude or OpenAI) executed server-side only, never from the client.

Monetization Model: B2B SaaS — licensed to retailers as an embeddable negotiation-and-checkout layer on top of their existing product catalog (demo scope: single-retailer instance).

Theme / Branding: Dark, warm, high-trust "dealmaking" aesthetic — deep charcoal background, warm gold/amber accent for price and discount moments, calm sage-green for confirmations and order success. Typography: one confident display sans-serif for headings, a clean grotesk for body text, a monospace face reserved only for agent labels and price/data readouts.

---

**SYSTEM CONSTRAINTS**

- Backend: Supabase (Postgres, Supabase Auth for email/password + session management, Realtime, Edge Functions)

- Authentication is required to enter the chat/negotiation experience; unauthenticated visitors see only the landing page and a login/signup prompt

- No client-side exposure of any LLM API key or seller discount-limit values — all agent calls proxied through backend edge functions

- Persistent state: every negotiation session and every order is tied to the authenticated user's ID, stored server-side, survives refresh and re-login

- Real-time: any change to a product's active discount (`live_offers` table) or stock level must propagate to any open shopping session viewing that product within 2 seconds via Supabase Realtime — not polling

- Order placement must perform a real database write (decrementing stock, creating an order record) — not a simulated/fake confirmation

---

**FUNCTIONAL REQUIREMENTS (EXACT USER FLOW)**

1. Visitor lands on the homepage, sees Haggle's value proposition, and is prompted to **sign up or log in** (email + password via Supabase Auth) before starting a session.

2. Once authenticated, shopper enters the Chat Session View and starts a conversation with Haggle.

3. **Preference Agent** asks at most 3 short questions (one at a time): product category (constrained to values present in the `products` table), budget range (min/max in INR), and 1–2 explicit preferences/must-haves. Outputs a structured completion object once sufficient information is gathered.

4. System transitions automatically to the **Deal-Hunter Agent**, which queries `products` filtered by category and budget (±15% flexibility), cross-references `live_offers` for active discounts, ranks by tag-relevance, and returns the top 3 matches.

5. Matches render as a **visual, sortable product grid**: each card shows a representative image (Unsplash Source API keyed to category), product name, tags, and current effective price. Cards animate into ranked order.

6. System transitions to the **Negotiation Agent**, which opens with a proactive offer on the top-ranked product. Shopper can accept, decline, or push back conversationally.

7. Negotiation Agent enforces hard, non-negotiable seller-defined limits: maximum 15% single-item discount, OR 20% off a combined bundle for 2+ matched items (cannot combine both). Must never propose a discount outside these bounds regardless of conversational pressure.

8. When a deal is accepted, the specific product card updates live: original price struck through, negotiated price highlighted beside it (or bundle total if applicable).

9. **Order placement:** the shopper can click directly on any negotiated product card to place a real order at the negotiated price. Clicking triggers: a confirmation step (quantity, delivery address field), a real database write to an `orders` table, a stock decrement on the `products` table, and an on-screen order confirmation with an order ID.

10. Shopper can view past orders and past negotiation sessions from an account/orders page.

---

**NON-FUNCTIONAL REQUIREMENTS**

- Agent response latency: initial acknowledgment/typing indicator within 300ms of user input, even while the LLM call is in flight

- Real-time discount and stock propagation must not require a page refresh

- All LLM-facing prompts must enforce strict structured JSON output (parsed server-side; malformed responses trigger one automatic retry before a graceful in-voice error message)

- Order placement must be atomic — stock decrement and order creation succeed or fail together, never partially

- Mobile responsive down to 360px width

- No sensitive data (API keys, password hashes, seller discount logic internals) ever reaches the client bundle

- Visible keyboard focus states on all interactive elements; reduced-motion preference respected

---

**PAGE STRUCTURE**

1. **Landing Page** — value proposition, login/signup call-to-action, no chat access without authentication

2. **Login / Signup Page** — email + password fields, clear error states, redirect to Chat Session View on success

3. **Chat Session View** — chat log (agent-labeled messages) alongside live product grid; sidebar shows active agent indicator + session state (category, budget, stage)

4. **Order Confirmation Modal/Page** — triggered on product click: quantity selector, delivery address, final negotiated price, confirm button, success state with order ID

5. **Account / Orders History Page** — list of the authenticated user's past orders and past negotiation sessions

6. **Admin/Seller View (lightweight)** — internal page to view/edit `products` and toggle `live_offers`, for live demo purposes

---

**UI/UX RULES**

- Layout: chat panel and product grid side-by-side on desktop (chat ~55%, grid/sidebar ~45%); stacked vertically on mobile, chat first

- Colors: background `#15120E`, panel surface `#1F1B15`, elevated panel `#28221A`, border/line `#3A3226`, primary accent (gold) `#E8A33D`, secondary accent (sage) `#7FA88A`, negotiation/urgency accent `#E88C6B`, primary text `#F4EFE6`, muted text `#9C9284`

- Each agent's messages are visually distinguished by a colored label (gold for Preference, sage for Deal-Hunter, coral for Negotiation) — never by avatar icons alone

- Price changes use a single deliberate motion (strikethrough fade + highlight scale-in on the new price) — no scattered hover animations elsewhere

- Product cards are clearly clickable (cursor state + subtle elevation on hover) to signal "this leads to an order," distinct from the passive negotiation-update animation

- Avoid generic SaaS-card styling (identical rounded corners + soft grey shadow on every element) — differentiate chat bubbles, product cards, and order confirmation with distinct but harmonious treatments

---

**TECHNICAL STACK**

- Frontend: React (Vite), Tailwind CSS

- Backend: Supabase (Postgres, Auth, Realtime, Edge Functions for LLM proxying and order logic)

- LLM: Claude or OpenAI API called exclusively from Supabase Edge Functions

- Image source: Unsplash Source API (category-keyed queries) for product placeholder imagery

- Deployment: single public URL serving both frontend and backend function endpoints, no local setup required for evaluation

---

**INTEGRATION / AUTOMATION LOGIC**

- `users`: managed by Supabase Auth

- `products`: `id, name, category, price, tags (text[]), stock_count`

- `live_offers`: `id, product_id (fk), discount_pct, expires_at, active (bool)` — Realtime channel subscribed by any open session viewing a matching product

- `negotiation_sessions`: `id, user_id (fk), created_at, category, budget_min, budget_max, preferences (text[]), stage (enum: preference|hunter|negotiation|closed), product_id (fk, nullable), final_price (nullable)`

- `orders`: `id, user_id (fk), product_id (fk), quantity, negotiated_price, delivery_address, created_at, status (enum: placed|confirmed)`

- Edge Function `preference-agent`: receives conversation history, returns structured JSON completion object

- Edge Function `negotiation-agent`: receives matched products + conversation history + hardcoded `DEAL_RULES` (max_single_discount_pct: 15, bundle_discount_pct: 20, bundle_min_items: 2), returns structured JSON per turn; discount limits enforced server-side as a hard validation clamp on the LLM's output before it ever reaches the client

- Edge Function `place-order`: validates stock availability, performs atomic stock decrement + order insert, returns order confirmation

- Deal-Hunter matching logic runs as a plain database query + ranking function — no LLM call required for this stage

---

**OUTPUT EXPECTATIONS**

- Fully working, deployed application with a single live URL, including functioning signup/login

- Clean component structure: ChatLog, MessageBubble, ProductGrid, ProductCard, AgentSidebar, SessionStateBox, OrderModal, OrdersHistoryList

- Seed data: minimum 8 products across exactly 2 categories (running shoes, earbuds) with realistic INR pricing, plus 2–3 pre-seeded `live_offers` rows with short expiry windows for real-time demo purposes

- Server-side enforcement of all negotiation limits and order atomicity must be independently verifiable — not solely reliant on prompt instructions to the LLM

---

**RESTRICTIONS — DO NOT**

- Do not expose any LLM API key, password hashes, or seller discount-limit values in client-side code

- Do not allow the Negotiation Agent's output to reach the client without server-side validation against `DEAL_RULES`

- Do not use polling to simulate real-time updates — use genuine Supabase Realtime subscriptions

- Do not simulate order placement — every order must be a real database write with real stock impact

- Do not integrate actual third-party payment gateways — order placement is a real record creation, not a live payment transaction, for demo scope

- Do not add unrelated features (wishlist, product reviews, multi-seller marketplace logic) — scope is strictly authentication, negotiation, and order placement
Use This Attached Image As Logo

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/3f9ec630-4905-4816-9253-ae3bd2d5b7c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev


```
