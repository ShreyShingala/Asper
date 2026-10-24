"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Check, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Eyebrow, Logo, ProgressBar, Spinner, TextField, cx } from "@/components/ui";

export type PlanShot = { id: string; spot: number; room: string; surface: string; kind: string; title: string; instruction: string; target: string; frame: string };
type Options = { rooms: string[]; surfaces: Record<string, string>; sizes: Record<string, string>; smell_leak: Record<string, string>; max_spots: number };
type Spot = { room: string; surface: string };
type Step = "room" | "surface" | "spots" | "size" | "smell" | "postal" | "plan";

function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rise mt-6">
      <h1 className="text-h6 font-semibold text-ink">{title}</h1>
      {sub && <p className="mt-1 text-subtitle font-light text-ink-body">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 5 tap questions before the camera opens: spots (room + where, up to 3), size, smell/leak, postal code. */
export function Precall({ caseId, onPlan, onStart }: { caseId: string; onPlan: (p: PlanShot[]) => void; onStart: () => void }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [step, setStep] = useState<Step>("room");
  const [room, setRoom] = useState<string | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [size, setSize] = useState<string | null>(null);
  const [smell, setSmell] = useState<string | null>(null);
  const [postal, setPostal] = useState("");
  const [plan, setPlan] = useState<PlanShot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<Options>("/live/precall").then(setOpts).catch((e: Error) => setErr(e.message)); }, []);

  const order: Step[] = ["room", "surface", "spots", "size", "smell", "postal", "plan"];
  const progress = Math.round((order.indexOf(step) / (order.length - 1)) * 100);
  const back = () => setStep(step === "surface" ? (spots.length ? "spots" : "room") : step === "size" ? "spots" : step === "smell" ? "size"
    : step === "postal" ? "smell" : step === "spots" ? "room" : step);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ plan: PlanShot[] }>(`/cases/${caseId}/live/precall`, { spots, size, smell_leak: smell, location: postal });
      setPlan(r.plan); onPlan(r.plan); setStep("plan");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!opts) return <div className="grid min-h-dvh place-items-center">{err ? <p role="alert" className="text-kit-red">{err}</p> : <Spinner label="Loading…" />}</div>;

  const choice = (label: string, on: boolean, onClick: () => void) => (
    <Button key={label} size="lg" multiline variant={on ? "primary" : "outline"} aria-pressed={on} onClick={onClick} className="justify-start text-left">{label}</Button>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-5">
      <div className="flex items-center justify-between">
        <Logo small />
        {step !== "room" && step !== "plan" && <Button variant="text" size="sm" leading={<ArrowLeft size={14} aria-hidden />} onClick={back}>Back</Button>}
      </div>
      <div className="mt-4"><ProgressBar value={progress} label="Before the call" /></div>

      {step === "room" && (
        <Q title={spots.length ? "Where is the next spot?" : "Where is the problem?"} sub="Pick the room. You can add up to 3 spots.">
          <div className="grid grid-cols-2 gap-2">{opts.rooms.map((r) => choice(r, room === r, () => { setRoom(r); setStep("surface"); }))}</div>
        </Q>
      )}
      {step === "surface" && room && (
        <Q title={`Where in the ${room.toLowerCase()}?`} sub="This tells Bruce exactly which photos to guide you through.">
          <div className="grid gap-2">{Object.entries(opts.surfaces).map(([id, label]) => choice(label, false, () => {
            setSpots((s) => [...s.filter((x) => !(x.room === room && x.surface === id)), { room, surface: id }].slice(0, opts.max_spots));
            setRoom(null); setStep("spots");
          }))}</div>
        </Q>
      )}
      {step === "spots" && (
        <Q title="Your spots" sub="Add another spot if there is more than one problem area.">
          <ul className="space-y-2">
            {spots.map((s, i) => (
              <li key={`${s.room}-${s.surface}`}>
                <Card className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-tint text-caption font-semibold text-brand-strong">{i + 1}</span>
                  <span className="flex-1 text-subtitle text-ink">{s.room} · {opts.surfaces[s.surface].toLowerCase()}</span>
                  <button type="button" aria-label={`Remove spot ${i + 1}`} onClick={() => setSpots((x) => x.filter((_, j) => j !== i))}
                    className="grid h-11 w-11 place-items-center rounded-full text-ink-muted hover:bg-kit-gray-faint"><X size={16} aria-hidden /></button>
                </Card>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid gap-2">
            {spots.length < opts.max_spots && <Button size="lg" variant="outline" leading={<Plus size={18} aria-hidden />} onClick={() => setStep("room")}>Add another spot</Button>}
            <Button size="lg" disabled={!spots.length} onClick={() => setStep("size")}>Next</Button>
          </div>
        </Q>
      )}
      {step === "size" && (
        <Q title="How big is it?" sub="Roughly, for the biggest spot.">
          <div className="grid gap-2">{Object.entries(opts.sizes).map(([id, label]) => choice(label, size === id, () => { setSize(id); setStep("smell"); }))}</div>
        </Q>
      )}
      {step === "smell" && (
        <Q title="Have you noticed a musty smell or a leak?">
          <div className="grid gap-2">{Object.entries(opts.smell_leak).map(([id, label]) => choice(label, smell === id, () => { setSmell(id); setStep("postal"); }))}</div>
        </Q>
      )}
      {step === "postal" && (
        <Q title="What's your postal code?" sub="Or your country, if you're outside Canada.">
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); if (postal.trim()) void submit(); }}>
            <TextField value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="e.g. K1A 0B1" aria-label="Postal code or country"
              autoComplete="postal-code" />
            {err && <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-subtitle text-kit-red">{err}</p>}
            <Button type="submit" size="lg" fullWidth disabled={!postal.trim()} state={busy ? "loading" : undefined}>See my photo plan</Button>
          </form>
        </Q>
      )}
      {step === "plan" && (
        <Q title={`Bruce will guide you through ${plan.length} photos`} sub="Follow the orange box. Photos snap automatically when you hold steady, and you can retake any of them.">
          <ol className="space-y-2">
            {plan.map((s, i) => (
              <li key={s.id}>
                <Card className="flex items-start gap-3 px-4 py-3">
                  <span className={cx("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-semibold", s.kind === "sweep" ? "bg-brand text-white" : "bg-brand-tint text-brand-strong")}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-subtitle font-medium text-ink">{s.title}</span>
                    <span className="block text-caption font-light text-ink-body">{s.instruction}</span>
                  </span>
                </Card>
              </li>
            ))}
          </ol>
          <div className="mt-6 grid gap-2">
            <Button size="lg" fullWidth leading={<Camera size={18} aria-hidden />} onClick={onStart}>Open camera and start</Button>
            <Eyebrow className="flex items-center justify-center gap-1.5"><Check size={12} aria-hidden />Answers saved</Eyebrow>
          </div>
        </Q>
      )}
    </main>
  );
}
