import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo, Wordmark } from "./Logo";

export function AppHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setEmail(data.user?.email ?? null);
      })
      .catch(() => {
        if (active) setEmail(null);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <Logo className="h-8" />
          <Wordmark />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {email ? (
            <>
              <NavLink to="/chat" label="Negotiate" />
              <NavLink to="/orders" label="Orders" />
              <NavLink to="/admin" label="Seller" />
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="label-mono text-muted-foreground hover:text-foreground"
              >
                sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ to, label }: { to: "/chat" | "/orders" | "/admin"; label: string }) {
  return (
    <Link
      to={to}
      className="label-mono px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "label-mono px-2 py-1.5 text-gold" }}
    >
      {label}
    </Link>
  );
}
