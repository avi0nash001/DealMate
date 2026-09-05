import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { placeOrder } from "@/lib/session.functions";
import { inr, type ProductRow } from "@/lib/deal";

type Placed = { id: string; quantity: number; unit_price: number; total: number; product_name: string };

export function OrderModal({
  product,
  unitPrice,
  sessionId,
  onClose,
  onPlaced,
}: {
  product: ProductRow | null;
  unitPrice: number;
  sessionId: string | null;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const place = useServerFn(placeOrder);
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);

  const reset = () => {
    setQuantity(1);
    setAddress("");
    setError(null);
    setPlaced(null);
    setBusy(false);
  };

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const order = await place({
        data: { productId: product!.id, sessionId, quantity, deliveryAddress: address.trim() },
      });
      setPlaced(order);
      onPlaced();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Could not place the order");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={product != null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="border-border bg-surface-elevated sm:max-w-md">
        {placed ? (
          <div className="space-y-4 text-center">
            <div className="label-mono text-sage">order confirmed</div>
            <h2 className="font-display text-2xl">{placed.product_name}</h2>
            <p className="price-mono deal-pop text-3xl font-semibold text-sage">{inr(placed.total)}</p>
            <p className="text-sm text-muted-foreground">
              {placed.quantity} × {inr(placed.unit_price)} · stock updated
            </p>
            <p className="price-mono text-xs text-muted-foreground">Order ID {placed.id}</p>
            <Button
              className="w-full bg-sage text-sage-foreground hover:bg-sage/90"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Confirm your order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border border-border bg-surface p-3">
                <div className="text-sm font-medium">{product?.name}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="label-mono text-gold">negotiated price</span>
                  <span className="price-mono text-lg font-semibold text-gold">{inr(unitPrice)}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={Math.min(10, product?.stock_count ?? 10)}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="bg-surface"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="addr">Delivery address</Label>
                <Textarea
                  id="addr"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Flat, street, city, PIN"
                  className="bg-surface"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="label-mono text-muted-foreground">total</span>
                <span className="price-mono text-xl font-semibold">{inr(unitPrice * quantity)}</span>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                disabled={busy || address.trim().length < 8}
                onClick={submit}
              >
                {busy ? "Placing order…" : "Place order"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Demo scope: a real order record, no payment is taken.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
