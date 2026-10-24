"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Sparkles, Database } from "lucide-react";
import QRCode from "qrcode";
import { photoUrl, type Flag, type Photo } from "@/lib/api";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function ProvenancePill({ tier, ms, model, className }: { tier?: string | null; ms?: number | null; model?: string | null; className?: string }) {
  if (!tier) return null;
  const live = tier === "live" || tier === "fallback";
  const short = (model ?? "").split("/").pop()?.replace(":free", "").split("-").slice(0, 2).join("-");
  return (
    <span
      title={live ? `Generated live by ${model}` : "Replayed from a saved response (offline-safe demo mode)"}
      className={cx("stamp inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        live ? "border-moss/30 bg-moss-2 text-moss" : "border-line bg-paper-2 text-ink-2", className)}>
      {live ? <Sparkles size={11} /> : <Database size={11} />}
      {live ? `Live AI · ${short}${ms ? ` · ${(ms / 1000).toFixed(1)}s` : ""}${tier === "fallback" ? " · fallback" : ""}` : tier === "exact_cache" ? "Cached AI response" : "Replayed (fixture)"}
    </span>
  );
}

export function AnnotatedPhoto({ caseId, photo, showBoxes = true, analyzing, className, onClick }: {
  caseId: string; photo: Photo; showBoxes?: boolean; analyzing?: boolean; className?: string; onClick?: () => void;
}) {
  const regions = photo.analysis?.regions ?? [];
  return (
    <div className={cx("relative overflow-hidden rounded-xl bg-ink/5", analyzing && "scanline", className)} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(caseId, photo.id)} alt={photo.caption_from_pack ?? photo.room ?? "photo"} className="block h-full w-full object-cover" />
      {showBoxes && regions.map((r, i) => {
        const [y0, x0, y1, x1] = r.box_2d;
        return (
          <div key={i} className="box-draw absolute rounded-md border-2 border-amber shadow-[0_0_0_1px_rgba(255,255,255,0.6)]"
            style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%`, animationDelay: `${i * 0.15}s` }}>
            <span className="stamp absolute -top-5 left-0 whitespace-nowrap rounded bg-amber px-1.5 py-0.5 text-[10px] text-white">
              {r.label.replace(/^look closer:\s*/i, "look closer · ").slice(0, 38)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const SEV = {
  block: { icon: AlertOctagon, cls: "border-rust/40 bg-rust-2 text-rust", label: "Must resolve" },
  warn: { icon: AlertTriangle, cls: "border-amber/40 bg-amber-2 text-[#8a5a0a]", label: "Check" },
  info: { icon: Info, cls: "border-line bg-card text-ink-2", label: "Info" },
} as const;

export function FlagRow({ flag, onResolve }: { flag: Flag; onResolve?: (f: Flag) => void }) {
  const s = SEV[flag.severity];
  const Icon = flag.resolved ? CheckCircle2 : s.icon;
  return (
    <div className={cx("rise rounded-xl border p-3", flag.resolved ? "border-moss/30 bg-moss-2/60 text-moss" : s.cls)}>
      <div className="flex items-start gap-2.5">
        <Icon size={18} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="stamp mb-0.5 uppercase opacity-80">
            {flag.resolved ? "Resolved" : s.label} · {flag.check.replace("_", " ")}
          </div>
          <p className="text-sm leading-snug text-ink">{flag.message}</p>
          {flag.source && <p className="stamp mt-1 opacity-70">source: {flag.source}</p>}
          {flag.resolved && flag.resolution_note && (
            <p className="mt-1 text-xs text-moss">✓ {flag.resolution_note} {flag.resolved_by && <span className="stamp">· {flag.resolved_by}</span>}</p>
          )}
        </div>
        {!flag.resolved && flag.severity !== "info" && onResolve && (
          <button onClick={() => onResolve(flag)} className="shrink-0 rounded-lg border border-current/30 bg-white/70 px-2.5 py-1 text-xs font-medium hover:bg-white">
            Resolve
          </button>
        )}
      </div>
    </div>
  );
}

export function Button({ className, variant = "primary", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50",
        variant === "primary" && "bg-moss text-white shadow-sm hover:bg-moss/90",
        variant === "outline" && "border border-ink/15 bg-card text-ink hover:bg-paper-2",
        variant === "ghost" && "text-ink-2 hover:bg-paper-2",
        className)} />
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx("rounded-2xl border border-line bg-card shadow-[0_1px_0_rgba(22,33,29,0.04)]", className)} />;
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={cx("font-display font-semibold tracking-tight text-moss", small ? "text-lg" : "text-2xl")}>MoldFlow</span>
      <span className="stamp text-ink-2">by Mold Busters</span>
    </span>
  );
}

export function StaffShell({ children, title, actions }: { children: React.ReactNode; title?: string; actions?: React.ReactNode }) {
  const path = usePathname();
  const nav = [
    ["/dashboard", "Inbox"],
    ["/cases/job1/inspect", "Job 1 · Inspect"],
    ["/cases/job1/review", "Job 1 · Review"],
    ["/compare", "Before / After"],
    ["/proof", "Proof"],
  ];
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
          <Link href="/dashboard"><Logo small /></Link>
          <nav className="flex gap-1 overflow-x-auto">
            {nav.map(([href, label]) => (
              <Link key={href} href={href}
                className={cx("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm", path === href ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2")}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">{actions}<QrLink /></div>
        </div>
      </header>
      <div className="border-b border-line bg-paper-2/70">
        <p className="stamp mx-auto max-w-7xl px-5 py-1.5 text-ink-2">
          Prototype · MoldFlow assists qualified inspectors; it does not identify, diagnose or confirm mold. Sending, booking and CRM sync are simulated.
        </p>
      </div>
      <main className="mx-auto max-w-7xl px-5 py-6">
        {title && <h1 className="mb-5 font-display text-3xl font-semibold tracking-tight">{title}</h1>}
        {children}
      </main>
    </div>
  );
}

export function QrLink() {
  const [src, setSrc] = useState<string>();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/`;
    QRCode.toDataURL(u, { margin: 1, width: 360, color: { dark: "#16211d", light: "#fffdf8" } }).then((s) => { setSrc(s); setUrl(u); });
  }, []);
  return (
    <>
      <Button variant="outline" className="min-h-9 px-3 text-xs" onClick={() => setOpen(true)}>Customer link / QR</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-6" onClick={() => setOpen(false)}>
          <Card className="rise p-6 text-center">
            <p className="mb-3 font-display text-xl">Scan to start a pre-assessment</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {src && <img src={src} alt="QR code" className="mx-auto h-72 w-72" />}
            <p className="stamp mt-3 text-ink-2">{url}</p>
          </Card>
        </div>
      )}
    </>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-moss/25 border-t-moss" />
      {label}
    </span>
  );
}

export function LangToggle({ lang, onChange }: { lang: "en" | "fr"; onChange: (l: "en" | "fr") => void }) {
  return (
    <div className="flex rounded-full border border-line bg-card p-0.5 text-xs font-semibold">
      {(["en", "fr"] as const).map((l) => (
        <button key={l} onClick={() => onChange(l)} className={cx("rounded-full px-3 py-1", lang === l ? "bg-ink text-paper" : "text-ink-2")}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
