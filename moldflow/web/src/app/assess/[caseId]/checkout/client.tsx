"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CreditCard, Lock, Mail } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { Button, Card, Eyebrow, Logo, TextField, buttonClass } from "@/components/ui";

const PRODUCTS = {
  ai_report: { price: 20, title: "AI pre-assessment report", points: ["Every photo annotated by AI: what it shows and where to look closer", "Room-by-room analysis, likely moisture sources and what photos can't tell", "Recommendations in the Mold Busters report format, as a PDF to share"] },
  tenant_pack: { price: 50, title: "Tenant action pack", points: ["We write to your landlord for you, from a Mold Busters address, with you copied", "Automatic follow-ups if they don't reply: formal notice, city property standards complaint", "Tribunal application prep with an evidence bundle. You approve every message first"] },
} as const;
type Product = keyof typeof PRODUCTS;

/** Simulated checkout: nothing is charged; only the last 4 digits are stored. */
export default function Checkout() {
  const { caseId } = useParams<{ caseId: string }>();
  const product = (useSearchParams().get("product") ?? "tenant_pack") as Product;
  const router = useRouter();
  const p = PRODUCTS[product] ?? PRODUCTS.tenant_pack;
  const [f, setF] = useState({ tenant_name: "", tenant_email: "", tenant_phone: "", landlord_name: "", landlord_email: "", card_name: "", card_number: "4242 4242 4242 4242", exp: "12 / 29", cvc: "123" });
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const pack = product === "tenant_pack";

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.post<CaseOut>(`/cases/${caseId}/checkout`, { product, ...f, authorize_auto: auto });
      setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
        <Card className="rise w-full space-y-4 p-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-alert-success-bg text-kit-green"><Check size={28} aria-hidden /></span>
          <h1 className="text-h6 font-semibold text-ink">Payment confirmed · ${p.price}.00</h1>
          <p className="text-subtitle font-light text-ink-body">Test mode: no money was charged. A receipt was added to your case.</p>
          {pack ? (
            <Button size="lg" fullWidth leading={<Mail size={18} aria-hidden />} onClick={() => router.push(`/assess/${caseId}/pack`)}>Track your action pack</Button>
          ) : (
            <a href={`/api/cases/${caseId}/export/ai-report.pdf`} target="_blank" rel="noreferrer" className={buttonClass({ size: "lg", fullWidth: true })}>Download your full report</a>
          )}
          <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "text", size: "lg" })}>Back to my pre-assessment</Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-10 pt-5">
      <div className="flex items-center justify-between">
        <Logo small />
        <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "text", size: "sm" })}><ArrowLeft size={14} aria-hidden />Back</Link>
      </div>
      <Card className="rise mt-6 overflow-hidden">
        <div className="bg-brand px-5 py-4 text-white">
          <Eyebrow color="text-white/90">Checkout</Eyebrow>
          <p className="mt-1 text-h6 font-semibold">{p.title}</p>
          <p className="text-subheading font-semibold">${p.price}.00 CAD</p>
        </div>
        <ul className="space-y-1.5 p-5 text-subtitle text-ink">
          {p.points.map((x) => <li key={x} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-kit-green" aria-hidden />{x}</li>)}
        </ul>
      </Card>

      <form onSubmit={pay} className="mt-5 space-y-4">
        {pack && (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-subheading font-semibold text-ink">Who we write for, and to</legend>
            <TextField label="Your full name" autoComplete="name" value={f.tenant_name} onChange={set("tenant_name")} />
            <TextField label="Your email (you're copied on everything)" type="email" autoComplete="email" value={f.tenant_email} onChange={set("tenant_email")} />
            <TextField label="Your mobile (for updates, optional)" type="tel" autoComplete="tel" value={f.tenant_phone} onChange={set("tenant_phone")} />
            <TextField label="Landlord or property manager name" value={f.landlord_name} onChange={set("landlord_name")} />
            <TextField label="Landlord email" type="email" value={f.landlord_email} onChange={set("landlord_email")} />
          </fieldset>
        )}
        {pack && (
          <label className="flex items-start gap-3 rounded-ds-sm bg-kit-gray-faint p-4 text-subtitle text-ink">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand)]" />
            <span>Send each step on my behalf automatically when it&apos;s due. I&apos;m copied on everything and can pause or stop at any time.
              <span className="block text-caption text-ink-muted">Untick to approve each letter yourself first.</span></span>
          </label>
        )}
        <fieldset className="space-y-3">
          <legend className="mb-1 flex items-center gap-1.5 text-subheading font-semibold text-ink"><CreditCard size={16} aria-hidden />Card</legend>
          <TextField label="Name on card" autoComplete="cc-name" value={f.card_name} onChange={set("card_name")} />
          <TextField label="Card number" inputMode="numeric" autoComplete="cc-number" value={f.card_number} onChange={set("card_number")} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Expiry" autoComplete="cc-exp" value={f.exp} onChange={set("exp")} />
            <TextField label="CVC" inputMode="numeric" autoComplete="cc-csc" value={f.cvc} onChange={set("cvc")} />
          </div>
        </fieldset>
        {err && <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-subtitle text-kit-red">{err}</p>}
        <Button type="submit" size="lg" fullWidth state={busy ? "loading" : undefined} leading={<Lock size={16} aria-hidden />}>Pay ${p.price}.00</Button>
        <p className="text-center text-caption font-light text-ink-muted">Test checkout: no card is charged. Use 4242 4242 4242 4242.</p>
      </form>
    </main>
  );
}
