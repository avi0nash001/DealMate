import logo from "@/assets/dealmate-logo.png.asset.json";

export function Logo({ className = "h-9" }: { className?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src={logo.url} alt="DealMate" className={className} />
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-lg font-semibold tracking-tight text-foreground">
      Deal<span className="text-coral">Mate</span>
    </span>
  );
}
