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
  const [step, setStep] = useState<"form" | "payment" | "processing">("form");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");

  const reset = () => {
    setQuantity(1);
    setAddress("");
    setError(null);
    setPlaced(null);
    setBusy(false);
    setStep("form");
    setCardNumber("");
    setExpiry("");
    setCvv("");
  };

  async function submit() {
    setBusy(true);
    setStep("processing");
    setError(null);
    // Purely cosmetic delay so the "payment" feels real — no real charge happens here.
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const order = await place({
        data: { productId: product!.id, sessionId, quantity, deliveryAddress: address.trim() },
      });
      setPlaced(order);
      onPlaced();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^.*Error:\s*/, "") : "Could not place the order");
      setStep("payment");
    } finally {
      setBusy(false);
    }
  }

  function formatCardNumber(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  }

  const cardValid = cardNumber.replace(/\D/g, "").length === 16 && expiry.length === 5 && cvv.length === 3;

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
        ) : step === "processing" ? (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="label-mono text-muted-foreground">processing payment…</p>
          </div>
        ) : step === "payment" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center justify-between border border-border bg-surface p-3">
                <span className="label-mono text-muted-foreground">amount due</span>
                <span className="price-mono text-lg font-semibold text-gold">{inr(unitPrice * quantity)}</span>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="card">Card number</Label>
                <Input
                  id="card"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="bg-surface price-mono"
                  maxLength={19}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                    }}
                    className="bg-surface price-mono"
                    maxLength={5}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    inputMode="numeric"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    className="bg-surface price-mono"
                    maxLength={3}
                  />
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button
                className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                disabled={!cardValid || busy}
                onClick={submit}
              >
                Pay {inr(unitPrice * quantity)}
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setStep("form")}>
                Back
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Demo scope: no real charge is made — this confirms a real order record.
              </p>
            </div>
          </>
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
                disabled={address.trim().length < 8}
                onClick={() => setStep("payment")}
              >
                Continue to payment
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Demo scope: a real order record, no live payment processor is connected.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
