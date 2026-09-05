import { AGENT_META, inr, type SessionState } from "@/lib/deal";

const STAGES: { key: SessionState["stage"]; agent: keyof typeof AGENT_META; blurb: string }[] = [
  { key: "preference", agent: "preference", blurb: "Learning what you want" },
  { key: "hunter", agent: "hunter", blurb: "Matching catalogue + live offers" },
  { key: "negotiation", agent: "negotiation", blurb: "Bargaining within seller limits" },
];

export function AgentSidebar({ session, live }: { session: SessionState; live: boolean }) {
  const activeIndex = STAGES.findIndex((s) => s.key === (session.stage === "closed" ? "negotiation" : session.stage));

  return (
    <aside className="space-y-4">
      <div className="border border-border bg-surface p-4">
        <div className="label-mono mb-3 text-muted-foreground">active agent</div>
        <ol className="space-y-3">
          {STAGES.map((stage, i) => {
            const meta = AGENT_META[stage.agent];
            const isActive = i === activeIndex;
            return (
              <li key={stage.key} className="flex items-start gap-3">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    isActive ? "bg-gold" : i < activeIndex ? "bg-sage" : "bg-border"
                  }`}
                />
                <div>
                  <div className={`label-mono ${isActive ? meta.className : "text-muted-foreground"}`}>
                    {meta.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{stage.blurb}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <SessionStateBox session={session} live={live} />
    </aside>
  );
}

export function SessionStateBox({ session, live }: { session: SessionState; live: boolean }) {
  return (
    <div className="border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="label-mono text-muted-foreground">session state</span>
        <span className="label-mono flex items-center gap-1.5 text-sage">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-sage" : "bg-muted-foreground"}`} />
          {live ? "live prices" : "connecting"}
        </span>
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="category" value={session.category ?? "—"} />
        <Row
          label="budget"
          value={
            session.budget_min || session.budget_max
              ? `${inr(session.budget_min ?? 0)} – ${inr(session.budget_max ?? 0)}`
              : "—"
          }
        />
        <Row label="stage" value={session.stage} />
        <Row label="deal price" value={session.final_price ? inr(session.final_price) : "—"} />
      </dl>
      {session.preferences.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {session.preferences.map((p) => (
            <span key={p} className="label-mono border border-border px-1.5 py-0.5 text-muted-foreground">
              {p}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd className="price-mono text-right text-sm text-foreground">{value}</dd>
    </div>
  );
}
