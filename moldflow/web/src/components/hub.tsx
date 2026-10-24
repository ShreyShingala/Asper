"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Calendar, CircleDollarSign, ClipboardList, Hand, Mail, MessageSquare, Phone, Search, ShieldOff, ShieldCheck, Sparkles, Database } from "lucide-react";
import { api, type S } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Tag } from "@/components/ds/kit/Feedback";

export type PersonRow = S["PersonRow"];
export type PersonView = S["PersonView"];
export type Contact = S["Contact"];
export type ProfileFact = S["ProfileFact"];
export type Message = S["Message"];
export type MessageRow = S["MessageRow"];
export type Interaction = S["Interaction"];
export type Moment = S["Moment"];
export type AlertView = S["AlertView"];
export type Task = S["Task"];

export const SYSTEMS: Record<string, { label: string; icon: typeof Phone; tone: string }> = {
  google_calendar: { label: "Google Calendar", icon: Calendar, tone: "bg-blue-50 text-blue-800" },
  freshbooks: { label: "FreshBooks", icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-800" },
  asana: { label: "Asana", icon: ClipboardList, tone: "bg-rose-50 text-rose-800" },
  close: { label: "Close CRM", icon: MessageSquare, tone: "bg-violet-50 text-violet-800" },
  brain: { label: "Brain", icon: Database, tone: "bg-amber-50 text-amber-900" },
  dialpad: { label: "Dialpad", icon: Phone, tone: "bg-indigo-50 text-indigo-800" },
  email: { label: "Email", icon: Mail, tone: "bg-sky-50 text-sky-800" },
  sms: { label: "SMS", icon: MessageSquare, tone: "bg-teal-50 text-teal-800" },
  moldflow: { label: "MoldFlow", icon: Sparkles, tone: "bg-brand-tint text-brand-strong" },
  bruce: { label: "Bruce (AI call)", icon: Bot, tone: "bg-brand-tint text-brand-strong" },
};

export function SourceChip({ system, className }: { system: string; className?: string }) {
  const s = SYSTEMS[system] ?? { label: system, icon: Database, tone: "bg-kit-gray-faint text-ink-body" };
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", s.tone, className)}>
      <Icon size={11} aria-hidden />{s.label}
    </span>
  );
}

export function SyntheticTag({ show }: { show?: boolean | null }) {
  if (!show) return null;
  return <span title="Invented for the demo: not a real customer" className="rounded bg-kit-gray-faint px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">synthetic</span>;
}

export function ByTag({ by }: { by?: string | null }) {
  if (!by) return null;
  return by === "ai"
    ? <Tag tone="green" soft className="gap-1"><Sparkles size={11} aria-hidden />AI</Tag>
    : by === "rule" ? <span title="Written by a fixed, reviewed template because the AI was unavailable"><Tag tone="gray" soft>Template</Tag></span>
      : <Tag tone="gray" soft>{by}</Tag>;
}

export const day = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" }) : "—");
export const dayTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

export function HubSearch() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA")) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!q.trim()) return;
    const id = setTimeout(() => { api.get<PersonRow[]>(`/search?q=${encodeURIComponent(q)}`).then((r) => { setRows(r); setOpen(true); }); }, 150);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <div className="relative">
      <label className="flex h-10 w-56 items-center gap-2 rounded-ds-xsm border border-kit-gray-soft bg-white px-3 text-subtitle focus-within:border-brand lg:w-72">
        <Search size={15} className="text-ink-muted" aria-hidden />
        <span className="sr-only">Search people by name, phone, address or case</span>
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => rows.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Name, phone, address…  ⌘K" className="w-full bg-transparent outline-none placeholder:text-ink-muted"
          onKeyDown={(e) => { if (e.key === "Enter" && rows[0]) router.push(`/people/${rows[0].id}`); }} />
      </label>
      {open && q.trim() && (
        <div className="absolute right-0 z-40 mt-1 w-80 overflow-hidden rounded-ds-sm bg-white shadow-ds-normal">
          {rows.length === 0 && <p className="p-3 text-caption text-ink-muted">No match</p>}
          {rows.map((r) => (
            <Link key={r.id} href={`/people/${r.id}`} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-kit-gray-faint">
              <span><span className="text-subtitle font-medium text-ink">{r.name}</span> <SyntheticTag show={r.synthetic} /><br />
                <span className="text-caption text-ink-muted">{r.city} · {r.phone}</span></span>
              {r.open_estimate ? <Tag tone="orange" soft>${Math.round(r.open_estimate).toLocaleString()}</Tag> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function PauseButton() {
  const [paused, setPaused] = useState<boolean | null>(null);
  useEffect(() => { api.get<{ paused: boolean }>("/settings/autonomy").then((a) => setPaused(a.paused)); }, []);
  if (paused === null) return null;
  const toggle = async () => setPaused((await api.post<{ paused: boolean }>("/settings/pause", { paused: !paused, by: "owner" })).paused);
  return (
    <button onClick={toggle} aria-pressed={paused}
      className={cn("inline-flex h-10 items-center gap-1.5 rounded-ds-xsm px-3 text-subtitle font-medium transition-colors",
        paused ? "bg-kit-red text-white" : "border border-kit-red/40 text-kit-red hover:bg-alert-danger-bg")}>
      {paused ? <ShieldOff size={15} aria-hidden /> : <ShieldCheck size={15} aria-hidden />}
      {paused ? "Outbound paused" : "Pause all outbound"}
    </button>
  );
}

export function OwnerBadge({ owner }: { owner: string }) {
  return owner.startsWith("human")
    ? <Tag tone="orange" soft className="gap-1"><Hand size={11} aria-hidden />{owner.replace("human:", "")} is handling this</Tag>
    : <Tag tone="gray" soft className="gap-1"><Bot size={11} aria-hidden />AI handles replies</Tag>;
}
