import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/dealmate/AppHeader";
import { Logo } from "@/components/dealmate/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DealMate — haggle with AI, then order at your price" },
      {
        name: "description",
        content:
          "DealMate's AI agents learn what you want, hunt live offers across the catalogue, and negotiate a real bounded discount you can order on instantly.",
      },
      { property: "og:title", content: "DealMate — haggle with AI, then order at your price" },
      {
        property: "og:description",
        content: "Three AI agents: they learn your brief, find matches, and negotiate a real discount in chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    label: "Preference Agent",
    color: "text-gold",
    title: "Three questions, no forms",
    body: "Category, budget in rupees, and your must-haves — asked one at a time in plain chat.",
  },
  {
    label: "Deal-Hunter Agent",
    color: "text-sage",
    title: "Live catalogue, live offers",
    body: "Ranks in-stock matches inside your budget and folds today's active discounts into the price.",
  },
  {
    label: "Negotiation Agent",
    color: "text-coral",
    title: "A real bargain, then order",
    body: "Haggles within the seller's hard limits, updates the price card live, and places a real order.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main>
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <span className="label-mono text-gold">conversational commerce</span>
              <h1 className="mt-4 text-4xl leading-[1.05] sm:text-6xl">
                Stop paying the
                <br />
                sticker price.
                <br />
                <span className="text-coral">Haggle for it.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                DealMate is a shopping chat where three AI agents learn your brief, hunt real matches with live
                offers, and then genuinely negotiate — inside the seller's limits. Accept and the order is placed on
                the spot.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
                  <Link to="/auth">Start a negotiation</Link>
                </Button>
                <span className="label-mono text-muted-foreground">sign in required to chat</span>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-border pt-6">
                <Stat value="15%" label="max single-item cut" />
                <Stat value="20%" label="bundle of 2+" />
                <Stat value="&lt;2s" label="live price sync" />
              </dl>
            </div>

            <div className="relative border border-border bg-surface p-8">
              <div className="absolute -top-3 left-6 bg-background px-2">
                <span className="label-mono text-sage">order confirmed</span>
              </div>
              <Logo className="mx-auto h-40" />
              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <ChatLine agent="Preference" color="text-gold" text="Budget for the earbuds?" />
                <ChatLine agent="Deal-Hunter" color="text-sage" text="3 matches, one already 12% off." />
                <ChatLine agent="Negotiation" color="text-coral" text="I can do ₹8,199 if you take them today." />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-surface/40">
          <div className="mx-auto grid max-w-7xl gap-px bg-border px-4 py-16 sm:px-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.label} className="bg-background p-6">
                <span className={`label-mono ${s.color}`}>{s.label}</span>
                <h2 className="mt-3 font-display text-xl">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl sm:text-4xl">The negotiation is real, not scripted.</h2>
          <p className="mt-4 text-muted-foreground">
            Every discount is checked against seller-defined limits on the server before it ever reaches your
            screen — and every accepted deal writes a real order with real stock impact.
          </p>
          <Button asChild size="lg" className="mt-8 bg-coral text-coral-foreground hover:bg-coral/90">
            <Link to="/auth">Try it now</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center">
        <span className="label-mono text-muted-foreground">DealMate · negotiation layer for retail</span>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="price-mono text-2xl font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: value }} />
      <dd className="label-mono mt-1 text-muted-foreground">{label}</dd>
    </div>
  );
}

function ChatLine({ agent, color, text }: { agent: string; color: string; text: string }) {
  return (
    <div>
      <div className={`label-mono ${color}`}>{agent}</div>
      <p className="border-l-2 border-border pl-3 text-sm text-foreground">{text}</p>
    </div>
  );
}
