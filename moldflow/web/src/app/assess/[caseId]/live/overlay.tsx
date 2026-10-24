"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, ListChecks, MessageCircle, RotateCcw } from "lucide-react";
import { cx } from "@/components/ui";
import type { PlanShot } from "./precall";

export type Box = { top: number; left: number; width: number; height: number };  // percent of the video area
export type BoxState = "aim" | "steady" | "snap";

/** Default framing per shot: where the target usually sits (from the photo plan's frame hint). */
export function defaultBox(frame: string | undefined): Box {
  switch (frame) {
    case "top": return { top: 8, left: 12, width: 76, height: 40 };
    case "bottom": return { top: 50, left: 12, width: 76, height: 38 };
    case "full": return { top: 10, left: 6, width: 88, height: 76 };
    default: return { top: 22, left: 14, width: 72, height: 48 };
  }
}

/** box_2d is [ymin, xmin, ymax, xmax] in 0-1000; pad it so the customer has some room. */
export function boxFrom2d(b: [number, number, number, number]): Box {
  const pad = 40;
  const [y0, x0, y1, x1] = [Math.max(0, b[0] - pad), Math.max(0, b[1] - pad), Math.min(1000, b[2] + pad), Math.min(1000, b[3] + pad)];
  return { top: y0 / 10, left: x0 / 10, width: Math.max(18, (x1 - x0) / 10), height: Math.max(14, (y1 - y0) / 10) };
}

export function FocusBox({ box, state, label }: { box: Box; state: BoxState; label?: string }) {
  const color = state === "aim" ? "border-brand" : "border-kit-green";
  return (
    <div aria-hidden className={cx("pointer-events-none absolute rounded-ds-sm border-[3px] transition-all duration-500", color,
      state === "snap" && "animate-pulse")}
      style={{ top: `${box.top}%`, left: `${box.left}%`, width: `${box.width}%`, height: `${box.height}%`,
        boxShadow: "0 0 0 9999px rgb(20 16 42 / 0.28)" }}>
      {[["-left-1 -top-1", "border-l-[6px] border-t-[6px]"], ["-right-1 -top-1", "border-r-[6px] border-t-[6px]"],
        ["-left-1 -bottom-1", "border-l-[6px] border-b-[6px]"], ["-right-1 -bottom-1", "border-r-[6px] border-b-[6px]"]].map(([pos, b]) => (
        <span key={pos} className={cx("absolute h-6 w-6 rounded-[4px]", pos, b, color)} />
      ))}
      {label && (
        <span className={cx("absolute -top-8 left-0 max-w-[85vw] truncate rounded-ds-xsm px-2 py-1 text-caption font-semibold text-white",
          state === "aim" ? "bg-brand" : "bg-kit-green")}>{state === "aim" ? label : state === "steady" ? "Looks good: tap the shutter" : "Got it"}</span>
      )}
    </div>
  );
}

export function ShotList({ plan, taken, current, open, onToggle }: {
  plan: PlanShot[]; taken: string[]; current: string | null; open: boolean; onToggle: () => void;
}) {
  const done = plan.filter((s) => taken.includes(s.id)).length;
  return (
    <aside className={cx("absolute right-0 top-14 z-20 flex transition-transform duration-300", open ? "translate-x-0" : "translate-x-[calc(100%-44px)]")}
      aria-label="Shot list">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={open ? "Hide shot list" : "Show shot list"}
        className="mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-l-ds-sm bg-kit-navy/85 text-white">
        {open ? <ChevronRight size={18} aria-hidden /> : <span className="relative"><ChevronLeft size={18} aria-hidden />
          <span className="absolute -right-3 -top-3 rounded-full bg-brand px-1 text-[10px] font-semibold">{done}/{plan.length}</span></span>}
      </button>
      <div className="max-h-[50dvh] w-60 overflow-y-auto rounded-bl-ds-sm bg-kit-navy/85 p-3 text-white backdrop-blur">
        <p className="mb-2 flex items-center gap-1.5 text-caption font-semibold"><ListChecks size={14} aria-hidden />Shot list · {done}/{plan.length}</p>
        <ol className="space-y-1.5">
          {plan.map((s, i) => {
            const isDone = taken.includes(s.id), isNow = s.id === current;
            return (
              <li key={s.id} className={cx("flex gap-2 rounded-ds-xsm p-1.5 text-caption", isNow && "bg-brand/90", !isNow && isDone && "opacity-70")}>
                <span className={cx("grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold", isDone ? "bg-kit-green" : "bg-white/20")}>
                  {isDone ? <Check size={12} aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{s.title}</span>
                  {isNow && <span className="block font-light text-white/90">{s.instruction}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

export function CueWidget({ cue, history, thinking }: { cue?: string; history: { role: "ai" | "customer"; text: string }[]; thinking: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-ds-sm bg-kit-navy/80 p-3 text-white backdrop-blur" aria-live="polite">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold">B</span>
        <p className="min-h-7 flex-1 text-subtitle leading-snug">
          {thinking && !cue ? <span className="text-white/70">Bruce is thinking…</span> : cue ?? <span className="text-white/70">Bruce is getting ready…</span>}
        </p>
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Hide transcript" : "Show transcript"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10"><MessageCircle size={16} aria-hidden /></button>
      </div>
      {open && (
        <ol className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-white/15 pt-2 text-caption">
          {history.slice(-12).map((l, i) => <li key={i} className={l.role === "ai" ? "text-white" : "text-white/70"}>{l.role === "ai" ? "Bruce" : "You"}: {l.text}</li>)}
        </ol>
      )}
    </div>
  );
}

/** Follow-the-arrow sweep: the arrow travels left to right over `ms`; the caller grabs frames along the way. */
export function SweepGuide({ running, ms, onStart }: { running: boolean; ms: number; onStart: () => void }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const id = setInterval(() => setT(Math.min(1, (Date.now() - t0) / ms)), 50);
    return () => { clearInterval(id); setT(0); };
  }, [running, ms]);
  return (
    <div className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2">
      <div className="relative h-2 rounded-full bg-white/25">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(running ? t : 0) * 100}%` }} />
        <span className="absolute -top-5 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-brand text-white shadow-ds-lg transition-[left] duration-75"
          style={{ left: `${(running ? t : 0) * 100}%` }}><ArrowRight size={22} aria-hidden /></span>
      </div>
      <p className="mt-10 text-center text-subtitle font-medium text-white drop-shadow">
        {running ? "Slowly follow the arrow…" : "Start at the left edge of the problem area"}
      </p>
      {!running && (
        <div className="pointer-events-auto mt-3 flex justify-center">
          <button type="button" onClick={onStart} className="h-12 rounded-ds-xsm bg-brand px-6 text-body font-medium text-white">Start the scan</button>
        </div>
      )}
    </div>
  );
}

/** Shows the captured photo; auto-keeps after `autoKeepMs` unless the customer taps Retake. */
export function CapturePreview({ src, title, autoKeepMs, onKeep, onRetake }: {
  src: string; title: string; autoKeepMs: number; onKeep: () => void; onRetake: () => void;
}) {
  const [left, setLeft] = useState(autoKeepMs);
  // The parent re-renders every second (call timer) and passes a new onKeep each time; keep the latest in a ref so the
  // countdown isn't restarted on every render (otherwise auto-keep never fires during a call).
  const keepRef = useRef(onKeep);
  useEffect(() => { keepRef.current = onKeep; }, [onKeep]);
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const l = autoKeepMs - (Date.now() - t0);
      setLeft(l);
      if (l <= 0) { clearInterval(id); keepRef.current(); }
    }, 100);
    return () => clearInterval(id);
  }, [autoKeepMs, src]);
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-kit-navy/70 p-6" role="dialog" aria-label="Check this photo">
      <div className="w-full max-w-sm overflow-hidden rounded-ds-sm bg-white shadow-ds-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="max-h-[50dvh] w-full object-contain bg-kit-navy" />
        <div className="space-y-3 p-4">
          <p className="text-subtitle font-semibold text-ink">{title}</p>
          <div className="h-1 overflow-hidden rounded-full bg-kit-gray-soft"><div className="h-full bg-kit-green" style={{ width: `${Math.max(0, left / autoKeepMs) * 100}%` }} /></div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onRetake} className="inline-flex h-12 items-center justify-center gap-2 rounded-ds-xsm border border-brand text-body font-medium text-brand">
              <RotateCcw size={16} aria-hidden />Retake</button>
            <button type="button" onClick={onKeep} className="inline-flex h-12 items-center justify-center gap-2 rounded-ds-xsm bg-kit-green text-body font-medium text-white">
              <Check size={16} aria-hidden />Keep</button>
          </div>
        </div>
      </div>
    </div>
  );
}
