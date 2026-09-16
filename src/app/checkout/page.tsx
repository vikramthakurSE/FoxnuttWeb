"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SfPaymentDue, SfProduct, SfSavedAddress } from "@/lib/salesforce";
import { formatINR } from "@/lib/format";
import { useCart } from "@/components/CartProvider";
import { useDelivery } from "@/components/DeliveryProvider";
import OrderTotals from "@/components/OrderTotals";
import Spinner from "@/components/Spinner";
import {
  DEFAULT_DELIVERY_RULES,
  isPincode,
  orderTotals,
  pincodeInAddress,
  placeLabel,
  zoneSummary,
  type DeliveryRules,
} from "@/lib/delivery";
import BusinessAccountAccess from "@/components/BusinessAccountAccess";
import GstinVerify, { type GstinVerifyResult } from "@/components/GstinVerify";
import PaymentDueBlock from "@/components/PaymentDueBlock";
import OnlinePaymentPanel from "@/components/OnlinePaymentPanel";
import PlaceOrderButton, { type PlaceOrderButtonHandle } from "@/components/PlaceOrderButton";

type Step = "identify" | "details" | "done";

type PaymentMethod = "online" | "cod";

interface PlacedOrder {
  orderId: string;
  saleName: string | null;
  status: string;
  newCustomer: boolean;
  total: number;
  paymentMethod: PaymentMethod;
}

export default function CheckoutPage() {
  const { items, clear, ready } = useCart();
  const [products, setProducts] = useState<SfProduct[] | null>(null);
  const [rules, setRules] = useState<DeliveryRules>(DEFAULT_DELIVERY_RULES);
  // The PIN code field drives the shared delivery PIN code, so the header
  // chip and this form always agree.
  const { pin, ready: pinReady, setPincode } = useDelivery();
  const [pincode, setPincodeField] = useState("");
  const [pinChecking, setPinChecking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("identify");
  // True while checkout asks the backend who is signed in, whether a
  // payment is overdue, and which addresses are saved. Nothing else renders
  // until it answers, so the customer never sees login → details → pay-first
  // flash past one after another.
  const [booting, setBooting] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  // First-time buyers have no code and type their own number instead.
  const [firstTime, setFirstTime] = useState(false);
  const [typedPhone, setTypedPhone] = useState("");
  const [codeVerified, setCodeVerified] = useState(false);

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SfSavedAddress[]>([]);
  // Index into savedAddresses, or "new" for an address typed here.
  const [addressChoice, setAddressChoice] = useState<number | "new">("new");
  const addressRef = useRef<HTMLTextAreaElement>(null);
  const [gstin, setGstin] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");

  // GSTIN verification: only genuinely new accounts (no business code) are
  // gated — anyone with a code is an existing, already-known business.
  const [gstinVerified, setGstinVerified] = useState(false);
  const [gstinLegalName, setGstinLegalName] = useState<string | null>(null);
  const [gstinResolution, setGstinResolution] = useState<GstinVerifyResult | null>(null);

  const [busy, setBusy] = useState(false);
  const placeOrderRef = useRef<PlaceOrderButtonHandle>(null);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const checkPincode = useCallback(
    async (value: string) => {
      setPincodeField(value);
      setPinError(null);
      if (!isPincode(value)) return;
      setPinChecking(true);
      setPinError(await setPincode(value));
      setPinChecking(false);
    },
    [setPincode]
  );
  // Set when Salesforce says an old delivery is still unpaid: the form is
  // replaced by the pay-first panel until a recheck comes back clear.
  const [due, setDue] = useState<SfPaymentDue | null>(null);

  // Ask early, as soon as we know the code, so the customer does not fill
  // in the whole form before learning they must pay first. The order POST
  // enforces the same rule server-side; this is only the heads-up.
  const fetchDue = useCallback(async (): Promise<SfPaymentDue | null> => {
    try {
      const res = await fetch("/api/payment-due", { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as SfPaymentDue;
    } catch {
      return null;
    }
  }, []);

  // Recheck from the pay-first panel. Only reports; the panel decides when
  // to hand back to the form so it can show its "payment received" screen.
  const recheckDue = useCallback(async (): Promise<boolean> => {
    const d = await fetchDue();
    return d !== null && d.overdue.length === 0;
  }, [fetchDue]);

  // One backend round-trip decides the first screen: pay-first, delivery
  // details (prefilled), or login. Also re-run right after a code login.
  const bootstrap = useCallback(async () => {
    setBooting(true);
    const started = Date.now();
    try {
      const res = await fetch("/api/checkout/bootstrap", { cache: "no-store" });
      const d = (await res.json()) as {
        session: null | {
          phone: string;
          code?: string;
          accountName?: string;
          name?: string;
          gstinVerified?: boolean;
          gstinLegalName?: string | null;
        };
        due: SfPaymentDue;
        addresses: SfSavedAddress[];
      };
      // Keep the loader up long enough to read as deliberate, not a flicker.
      const wait = 500 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));

      if (!d.session?.phone) {
        setStep("identify");
        return;
      }
      setPhone(d.session.phone);
      setCode(d.session.code ?? null);
      setAccountName(d.session.accountName ?? null);
      if (d.session.name) setName(d.session.name);
      if (d.session.gstinVerified) {
        setGstinVerified(true);
        setGstinLegalName(d.session.gstinLegalName ?? null);
      }
      const saved = d.addresses ?? [];
      setSavedAddresses(saved);
      if (saved.length > 0) {
        setAddressChoice(0);
        setAddress(saved[0].address);
        const savedPin = pincodeInAddress(saved[0].address);
        if (savedPin) void checkPincode(savedPin);
      } else {
        setAddressChoice("new");
      }
      setDue(d.due && d.due.overdue.length > 0 ? d.due : null);
      setStep("details");
    } catch {
      // Unknown state: fall back to login, which re-checks everything.
      setStep("identify");
    } finally {
      setBooting(false);
    }
  }, [checkPincode]);

  useEffect(() => {
    void bootstrap();
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.products as SfProduct[]);
        if (d.delivery) setRules(d.delivery as DeliveryRules);
      })
      .catch(() => setProducts([]));
  }, [bootstrap]);

  // Start from the header's PIN code when the address did not supply one.
  useEffect(() => {
    if (pinReady && pin && pincode === "") setPincodeField(pin.location.pincode);
    // Only seeds an empty field; typing must not be overwritten.
  }, [pinReady, pin]);

  const rows =
    products === null
      ? []
      : items
          .map((i) => ({
            item: i,
            product: products.find((p) => p.slug === i.slug),
          }))
          .filter(
            (r): r is { item: (typeof items)[0]; product: SfProduct } =>
              Boolean(r.product)
          );

  // The shared PIN code only counts once it is the one in the field.
  const pinInfo = pin && pin.location.pincode === pincode ? pin : null;
  const totals = orderTotals(
    rows.map((r) => {
      const kg = (r.product.packSizeGrams * r.item.packets) / 1000;
      return { brand: r.product.brand, kg, amount: kg * r.product.pricePerKg };
    }),
    pinInfo?.rules ?? rules,
    pinInfo?.zone ?? null
  );
  const total = totals.total;
  const shortfall = (totals.quote?.shortfalls.length ?? 0) > 0;
  const pinBlocking = !pinInfo || pinChecking;

  // First-time buyers must attempt GSTIN verification (pass or soft-fail)
  // before they can place an order; existing business-code accounts never
  // hit this gate.
  const gstinBlocking = firstTime && !gstinResolution;

  // Runs the real order placement. Resolves false for any handled outcome
  // (a rejected order, a pay-first block) so the button's drive animation
  // simply resets rather than showing a false "delivered" checkmark; the
  // existing error/due UI already explains what happened. Only a genuine
  // success — where the button's own checkmark animation gets to play
  // out — goes on to swap in the confirmation screen, via finishOrder().
  async function submitOrder(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ slug: i.slug, packets: i.packets })),
          businessCode: code ?? undefined,
          phone: code ? undefined : typedPhone,
          name,
          businessName,
          address,
          pincode,
          gstin: firstTime ? gstinResolution?.gstin ?? "" : gstin,
          gstinVerified: firstTime ? Boolean(gstinResolution?.verified) : gstinVerified,
          note,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (res.status === 402 && json.code === "PAYMENT_OVERDUE") {
        setDue(json as SfPaymentDue);
        window.scrollTo({ top: 0 });
        return false;
      }
      if (!res.ok) throw new Error(json.error ?? "Could not place the order.");
      setPlaced({
        orderId: json.orderId,
        saleName: json.saleName,
        status: json.status,
        newCustomer: json.newCustomer,
        total: json.total,
        paymentMethod: json.paymentMethod === "online" ? "online" : "cod",
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function finishOrder() {
    clear();
    setStep("done");
    window.scrollTo({ top: 0 });
  }

  // ── Empty cart guard ───────────────────────────────────────────────────
  if (ready && items.length === 0 && step !== "done") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-2xl font-bold">Nothing to check out</p>
        <Link
          href="/products"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-pine px-7 font-semibold text-mist hover:bg-pine-dark"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {step !== "done" && (
        <h1 className="font-display text-3xl font-bold">Checkout</h1>
      )}

      {/* Wide screens: the current step on the left, order summary pinned
          on the right. The pay-first block takes the full width instead. */}
      {step !== "done" && (
        <div
          className={`mt-5 grid items-start gap-6 ${
            !booting && step === "details" && due
              ? ""
              : "lg:grid-cols-[minmax(0,1fr)_340px]"
          }`}
        >
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
      {/* Loader while the backend decides which screen to show */}
      {booting && (
        <div
          role="status"
          className="flex flex-col items-center rounded-2xl border border-line bg-card px-6 py-12 text-center shadow-card"
        >
          <Spinner size={36} className="text-pine" />
          <p className="mt-4 font-display text-lg font-bold">
            Getting your checkout ready
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Checking your account, payments and saved addresses…
          </p>
        </div>
      )}

      {/* Step 1 — identify: business code, or first-time details */}
      {!booting && step === "identify" && (
        <div className={`mx-auto max-w-lg rounded-2xl bg-card border border-line shadow-card p-6 ${codeVerified ? "nn-card-wobble" : ""}`}>
          {!firstTime ? (
            <BusinessAccountAccess
              continueLabel="Continue to checkout"
              onStageChange={(st) => setCodeVerified(st === "verified")}
              loginTitle="Enter your business code"
              loginSubtitle="We sent this to you on WhatsApp when we opened your account."
              onLoggedIn={() => {
                setCodeVerified(false);
                void bootstrap();
              }}
              footer={
                <div className="mt-5 border-t border-line pt-4 text-center">
                  <p className="text-sm text-ink-soft">
                    Ordering without an account?
                  </p>
                  <button
                    type="button"
                    onClick={() => setFirstTime(true)}
                    className="mt-1 text-sm font-semibold text-pine hover:underline"
                  >
                    Continue without a code
                  </button>
                </div>
              }
            />
          ) : (
            <>
              <h2 className="font-display text-xl font-bold">
                First time ordering
              </h2>
              <p className="mt-1 mb-4 text-sm text-ink-soft">
                We&apos;ll open an account for you and send your business code
                on WhatsApp, so your next order is one tap.
              </p>
              <label className="block text-sm font-semibold" htmlFor="nn-phone">
                WhatsApp mobile number
              </label>
              <div className="mt-1.5 flex gap-2">
                <span className="flex h-12 items-center rounded-xl border border-line bg-mist-2 px-3 text-sm font-semibold text-ink-soft">
                  +91
                </span>
                <input
                  id="nn-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit number"
                  value={typedPhone}
                  onChange={(e) =>
                    setTypedPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  className="h-12 flex-1 rounded-xl border border-line bg-card px-4 outline-none focus:border-pine"
                />
              </div>
              <button
                type="button"
                disabled={typedPhone.length !== 10}
                onClick={() => {
                  setPhone(typedPhone);
                  setStep("details");
                }}
                className="mt-3 h-12 w-full rounded-full bg-pine font-semibold text-mist hover:bg-pine-dark disabled:opacity-50"
              >
                Continue
              </button>
              <div className="mt-5 border-t border-line pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setFirstTime(false)}
                  className="text-sm font-semibold text-pine hover:underline"
                >
                  I have a business code
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pay-first gate — an old delivery is still unpaid */}
      {!booting && step === "details" && due && (
        <PaymentDueBlock
          due={due}
          onRecheck={recheckDue}
          onCleared={() => setDue(null)}
        />
      )}

      {/* Step 2 — details + place order */}
      {!booting && step === "details" && !due && (
        <form
          className="rounded-2xl bg-card border border-line shadow-card p-5 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!gstinBlocking && !pinBlocking && !shortfall) placeOrderRef.current?.trigger();
          }}
        >
          <h2 className="font-display text-xl font-bold">Delivery details</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {accountName ? (
              <>
                Ordering as{" "}
                <span className="font-semibold">{accountName}</span>{" "}
                <span className="text-xs">({code})</span>
              </>
            ) : (
              <>
                Ordering as{" "}
                <span className="font-semibold">+91 {phone ?? typedPhone}</span>
              </>
            )}
          </p>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <div>
              <label className="mt-4 block text-sm font-semibold" htmlFor="nn-name">
                Your name *
              </label>
              <input
                id="nn-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-pine"
              />

            </div>
            <div>
              <label
                className="mt-4 block text-sm font-semibold"
                htmlFor="nn-business"
              >
                Shop / business name (optional)
              </label>
              <input
                id="nn-business"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-pine"
              />

            </div>
          </div>

          <label
            className="mt-4 block text-sm font-semibold"
            htmlFor="nn-address"
          >
            Delivery address *
          </label>
          <textarea
            id="nn-address"
            ref={addressRef}
            value={address}
            onChange={(e) => {
              const v = e.target.value;
              setAddress(v);
              if (addressChoice !== "new" && v !== savedAddresses[addressChoice]?.address) {
                setAddressChoice("new");
              }
            }}
            required
            rows={3}
            placeholder={addressChoice === "new" && savedAddresses.length > 0 ? "Type the new delivery address" : undefined}
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-pine"
          />

          <label className="mt-4 block text-sm font-semibold" htmlFor="nn-pincode">
            PIN code *
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <input
              id="nn-pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              required
              value={pincode}
              onChange={(e) =>
                void checkPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              aria-invalid={Boolean(pinError)}
              aria-describedby="nn-pincode-status"
              className="h-12 w-36 rounded-xl border border-line bg-card px-4 tracking-widest outline-none focus:border-pine"
            />
            <p id="nn-pincode-status" className="min-w-0 flex-1 text-sm" aria-live="polite">
              {pinChecking ? (
                <span className="inline-flex items-center gap-2 text-ink-soft">
                  <Spinner size={14} /> Checking PIN code…
                </span>
              ) : pinError ? (
                <span className="text-danger">{pinError}</span>
              ) : pinInfo ? (
                <>
                  <span className="block font-semibold">{placeLabel(pinInfo.location)}</span>
                  <span className="block text-xs text-ink-soft">
                    {zoneSummary(pinInfo.rules, pinInfo.zone)}
                  </span>
                </>
              ) : (
                <span className="text-ink-soft">We check delivery rules for your area.</span>
              )}
            </p>
          </div>

          {savedAddresses.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Saved addresses
              </p>
              <ul className="mt-2 space-y-2" role="radiogroup" aria-label="Saved addresses">
                {savedAddresses.map((a, i) => {
                  const active = addressChoice === i;
                  return (
                    <li key={a.address}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setAddressChoice(i);
                          setAddress(a.address);
                          const savedPin = pincodeInAddress(a.address);
                          if (savedPin) void checkPincode(savedPin);
                        }}
                        className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors ${
                          active
                            ? "border-pine bg-pine/5 ring-1 ring-pine"
                            : "border-line bg-card hover:bg-mist-2"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            active ? "border-pine" : "border-ink-soft/50"
                          }`}
                        >
                          {active && <span className="h-2 w-2 rounded-full bg-pine" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block whitespace-pre-line text-ink">{a.address}</span>
                          <span className="mt-0.5 block text-xs text-ink-soft">
                            {i === 0 && a.source === "order"
                              ? "Used on your last order"
                              : a.source === "order"
                                ? "Used on a past order"
                                : "Account address"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={addressChoice === "new"}
                    onClick={() => {
                      setAddressChoice("new");
                      setAddress("");
                      requestAnimationFrame(() => addressRef.current?.focus());
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left text-sm font-semibold transition-colors ${
                      addressChoice === "new"
                        ? "border-pine bg-pine/5 text-pine"
                        : "border-line text-pine hover:bg-mist-2"
                    }`}
                  >
                    <span aria-hidden="true" className="text-lg leading-none">+</span>
                    Add a new address
                  </button>
                </li>
              </ul>
              <p className="mt-2 text-xs text-ink-soft">
                A new address is saved with this order for next time.
              </p>
            </div>
          )}

          {firstTime ? (
            <GstinVerify phone={typedPhone} onResolved={setGstinResolution} />
          ) : gstinVerified && gstinLegalName ? (
            <div className="mt-4 rounded-xl border border-leaf/40 bg-leaf/10 px-4 py-3 text-sm">
              <p className="font-semibold text-ink">✓ GST-verified business</p>
              <p className="mt-1 text-ink-soft">{gstinLegalName}</p>
            </div>
          ) : (
            <>
              <label className="mt-4 block text-sm font-semibold" htmlFor="nn-gstin">
                GSTIN (optional)
              </label>
              <input
                id="nn-gstin"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                maxLength={15}
                className="mt-1.5 h-12 w-full rounded-xl border border-line bg-card px-4 outline-none focus:border-pine"
              />
            </>
          )}

          <label className="mt-4 block text-sm font-semibold" htmlFor="nn-note">
            Note for us (optional)
          </label>
          <textarea
            id="nn-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-3 outline-none focus:border-pine"
          />

          <fieldset className="mt-5">
            <legend className="block text-sm font-semibold">How would you like to pay?</legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    id: "online" as const,
                    title: "Pay online",
                    body: "UPI now — scan our QR after placing the order. Nothing to pay on delivery.",
                    icon: "📱",
                  },
                  {
                    id: "cod" as const,
                    title: "Cash on Delivery",
                    body: "Pay when your order arrives, as agreed.",
                    icon: "💵",
                  },
                ] as const
              ).map((opt) => {
                const active = paymentMethod === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                      active
                        ? "border-pine bg-pine/5 ring-1 ring-pine"
                        : "border-line bg-card hover:bg-mist-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name="nn-pay"
                      value={opt.id}
                      checked={active}
                      onChange={() => setPaymentMethod(opt.id)}
                      className="sr-only"
                    />
                    <span className="text-xl" aria-hidden="true">{opt.icon}</span>
                    <span>
                      <span className="block font-semibold">{opt.title}</span>
                      <span className="block text-xs text-ink-soft">{opt.body}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <PlaceOrderButton
            ref={placeOrderRef}
            idleLabel={`Place order · ${formatINR(total)}`}
            disabled={gstinBlocking || pinBlocking || shortfall}
            onSubmit={submitOrder}
            onSuccessShown={finishOrder}
          />
          {gstinBlocking ? (
            <p className="mt-2 text-center text-xs font-semibold text-pine">
              Verify your GSTIN above to continue.
            </p>
          ) : pinBlocking && !pinChecking ? (
            <p className="mt-2 text-center text-xs font-semibold text-pine">
              Enter a valid delivery PIN code to continue.
            </p>
          ) : shortfall ? (
            <p className="mt-2 text-center text-xs font-semibold text-pine">
              Add the minimum weight shown in the summary, or{" "}
              <Link href="/cart" className="underline">edit your cart</Link>.
            </p>
          ) : null}
          <p className="mt-2 text-center text-xs text-ink-soft">
            {paymentMethod === "online"
              ? "You will see our UPI QR on the next screen."
              : "Payment on delivery, as agreed."}
          </p>
        </form>
      )}

          </div>

          {!(!booting && step === "details" && due) && (
            <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
          {/* Order summary */}
              <div className="rounded-2xl bg-card border border-line shadow-card p-4 text-sm">
                {rows.map(({ item, product }) => (
                  <div
                    key={item.slug}
                    className="flex justify-between gap-2 py-1"
                  >
                    <span className="text-ink-soft">
                      {product.name} × {item.packets}
                    </span>
                    <span className="font-semibold shrink-0">
                      {formatINR(
                        (product.pricePerKg *
                          product.packSizeGrams *
                          item.packets) /
                          1000
                      )}
                    </span>
                  </div>
                ))}
                <div className="mt-2 border-t border-line pt-2">
                  <OrderTotals totals={totals} pin={pinInfo} />
                </div>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Confirmation screens stay a readable single column. */}
      <div className="mx-auto max-w-md">
      {/* Step 3 — confirmation */}
      {step === "done" && placed && placed.paymentMethod === "online" && (
        <>
          <div className="rounded-2xl bg-card border border-line shadow-card p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-leaf/15 text-2xl">
              ✓
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold">
              {placed.status === "Confirmed" ? "Order confirmed!" : "Order received!"}
            </h1>
            {placed.saleName && (
              <p className="mt-1 text-sm text-ink-soft">
                Order number:{" "}
                <span className="font-semibold text-ink">{placed.saleName}</span>
              </p>
            )}
            {placed.status !== "Confirmed" && (
              <p className="mt-2 text-xs text-ink-soft">
                {placed.newCustomer
                  ? "We have sent your business code on WhatsApp. One of our executives will confirm the details shortly."
                  : "One of our executives will confirm the details shortly."}
              </p>
            )}
          </div>
          <OnlinePaymentPanel
            orderRef={placed.orderId}
            saleName={placed.saleName}
            amount={placed.total}
          />
        </>
      )}
      {step === "done" && placed && placed.paymentMethod === "cod" && (
        <div className="rounded-2xl bg-card border border-line shadow-card p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf/15 text-3xl">
            ✓
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold">
            {placed.status === "Confirmed"
              ? "Order confirmed!"
              : "Order received!"}
          </h1>
          {placed.saleName && (
            <p className="mt-1 text-sm text-ink-soft">
              Order number:{" "}
              <span className="font-semibold text-ink">{placed.saleName}</span>
            </p>
          )}
          <p className="mt-3 text-sm text-ink-soft">
            {placed.status === "Confirmed"
              ? "Your order is confirmed — the details are on their way to your WhatsApp."
              : "Thank you for your first order with us! One of our executives will get in touch with you shortly to confirm the details and complete your order."}
          </p>
          {placed.status !== "Confirmed" && (
            <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
              We&apos;ve also sent you a WhatsApp message with your{" "}
              <span className="font-semibold">business code</span> — use it to
              log in and order in one step next time.
            </p>
          )}
          <p className="mt-1 font-bold">{formatINR(placed.total)}</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/orders"
              className="h-12 rounded-full bg-pine font-semibold text-mist hover:bg-pine-dark flex items-center justify-center"
            >
              View my orders
            </Link>
            <Link
              href="/products"
              className="h-12 rounded-full border border-ink/20 font-semibold hover:bg-mist-2 flex items-center justify-center"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
