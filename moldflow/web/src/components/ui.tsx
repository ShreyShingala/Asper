"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Sparkles, Database, QrCode } from "lucide-react";
import QRCode from "qrcode";
import { photoUrl, type Flag, type Photo } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ds/kit/Buttons";
import { cardSurface } from "@/components/ds/kit/Cards";
import { Loader, Modal, Tag } from "@/components/ds/kit/Feedback";
import { Tabs } from "@/components/ds/kit/Navigation";
import { HubSearch, PauseButton } from "@/components/hub";

export { Button, IconButton, buttonClass } from "@/components/ds/kit/Buttons";
export { EmptyState } from "@/components/ds/kit/Cards";
export { Modal, Tag, Tooltip, Popover } from "@/components/ds/kit/Feedback";
export { KitInput, KitSelect, KitTextarea } from "@/components/ds/kit/Forms";
export { ProgressBar } from "@/components/ds/kit/Progress";
export { SidebarMenu } from "@/components/ds/kit/Navigation";
export { TextArea, TextField } from "@/components/ds/TextField";
export const cx = cn;

/** Uppercase metadata / section label. */
export function Eyebrow({ className, color = "text-ink-muted", ...p }: React.HTMLAttributes<HTMLParagraphElement> & { color?: string }) {
  return <p {...p} className={cn("eyebrow uppercase", color, className)} />;
}

export function ProvenancePill({ tier, ms, model, className }: { tier?: string | null; ms?: number | null; model?: string | null; className?: string }) {
  if (!tier) return null;
  const live = tier === "live" || tier === "fallback";
  const short = (model ?? "").split("/").pop()?.replace(":free", "").split("-").slice(0, 2).join("-");
  return (
    <span title={live ? `Generated live by ${model}` : tier === "rule" ? "Answered by an on-server brightness check without calling the AI" : "Replayed from a saved response (offline-safe demo mode)"} className="inline-flex">
      <Tag tone={live ? "green" : "gray"} soft className={cn("gap-1", className)}>
        {live ? <Sparkles size={11} aria-hidden /> : <Database size={11} aria-hidden />}
        {live ? `Live AI · ${short}${ms ? ` · ${(ms / 1000).toFixed(1)}s` : ""}${tier === "fallback" ? " · fallback" : ""}` : tier === "exact_cache" ? "Cached AI response" : tier === "rule" ? "Too dark: brightness check, no AI" : "Replayed (fixture)"}
      </Tag>
    </span>
  );
}

export function AnnotatedPhoto({ caseId, photo, showBoxes = true, analyzing, className, onClick }: {
  caseId: string; photo: Photo; showBoxes?: boolean; analyzing?: boolean; className?: string; onClick?: () => void;
}) {
  const regions = photo.analysis?.regions ?? [];
  return (
    <div className={cn("relative overflow-hidden rounded-ds-xsm bg-kit-gray-soft", analyzing && "scanline", className)} onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl(caseId, photo.id)} alt={photo.caption_from_pack ?? photo.room ?? "photo"} className="block h-full w-full object-cover" />
      {showBoxes && regions.map((r, i) => {
        const [y0, x0, y1, x1] = r.box_2d;
        return (
          <div key={i} className="box-draw absolute rounded-ds-xsm border-2 border-warning shadow-[0_0_0_1px_rgba(15,20,42,0.55)]"
            style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%`, animationDelay: `${i * 0.15}s` }}>
            <span className={cn("absolute left-0 max-w-[220px] truncate whitespace-nowrap rounded-ds-xsm bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-ink",
              y0 < 70 ? "top-0" : "-top-5")}>
              {r.label.replace(/^look closer:\s*/i, "look closer · ").slice(0, 38)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Flag severities map onto the design system's alert colours. */
const SEV = {
  block: { icon: AlertOctagon, box: "bg-alert-danger-bg", accent: "text-alert-danger-accent", dot: "bg-alert-danger-accent", label: "Must resolve" },
  warn: { icon: AlertTriangle, box: "bg-alert-warning-bg", accent: "text-kit-orange", dot: "bg-alert-warning-accent", label: "Check" },
  info: { icon: Info, box: "bg-kit-gray-faint", accent: "text-ink-body", dot: "bg-ink-muted", label: "Info" },
} as const;
const RESOLVED = { icon: CheckCircle2, box: "bg-alert-success-bg", accent: "text-alert-success-title", dot: "bg-alert-success-accent", label: "Resolved" };

export function FlagRow({ flag, onResolve }: { flag: Flag; onResolve?: (f: Flag) => void }) {
  const s = flag.resolved ? RESOLVED : SEV[flag.severity];
  const Icon = s.icon;
  return (
    <div role={!flag.resolved && flag.severity === "block" ? "alert" : undefined} className={cn("rise rounded-ds-sm p-3", s.box)}>
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white", s.dot)}>
          <Icon size={14} strokeWidth={2.5} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("eyebrow mb-0.5 font-semibold uppercase", s.accent)}>
            {s.label} · {flag.check.replace("_", " ")}
          </p>
          <p className="text-subtitle text-ink">{flag.message}</p>
          {flag.source && <p className="mt-1 text-caption font-light text-ink-muted">source: {flag.source}</p>}
          {flag.resolved && flag.resolution_note && (
            <p className="mt-1 text-caption text-alert-success-text">✓ {flag.resolution_note} {flag.resolved_by && <span className="text-ink-muted">· {flag.resolved_by}</span>}</p>
          )}
        </div>
        {!flag.resolved && flag.severity !== "info" && onResolve && (
          <Button size="sm" variant="outline" onClick={() => onResolve(flag)} className="shrink-0">Resolve</Button>
        )}
      </div>
    </div>
  );
}

const CARD_TONE = {
  danger: "border-alert-danger-accent/30 bg-alert-danger-bg",
  warning: "border-alert-warning-accent/40 bg-alert-warning-bg",
  success: "border-kit-green/30 bg-alert-success-bg",
  info: "border-brand/25 bg-brand-tint",
} as const;
export type CardTone = keyof typeof CARD_TONE;

export function Card({ className, tone, ...p }: React.HTMLAttributes<HTMLDivElement> & { tone?: CardTone }) {
  return <div {...p} className={cn(tone ? cn("rounded-ds-xsm border", CARD_TONE[tone]) : cardSurface, className)} />;
}

export function Logo({ small }: { small?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand wordmark asset; keep crisp at all densities
    <img
      src="/brand/mold-busters-wordmark.png"
      alt="Mold Busters"
      height={small ? 36 : 44}
      className={cn("w-auto", small ? "h-9" : "h-11")}
      draggable={false}
    />
  );
}

const NAV_GROUPS: { label: string; items: [string, string][] }[] = [
  { label: "Today", items: [["/hub", "Hub"], ["/outreach", "Outreach"], ["/demo-texts", "Demo texts"]] },
  { label: "Customers", items: [["/map", "Map"], ["/customers", "Customers"], ["/people", "People"], ["/projects", "Projects"]] },
  { label: "Field work", items: [["/schedule", "Schedule"], ["/dashboard", "Cases"], ["/alerts", "Storm alerts"], ["/research", "Research"]] },
  { label: "Company", items: [["/settings", "Settings"], ["/proof", "Proof"]] },
];
const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

/** Staff shell (taste-skill "ruled T-frame"): sidebar + 64px top bar on one ground, divided by 1px rules only. The active page is a
 *  pale orange row in the hue's dark ink; full orange is kept for small marks and the one primary action. */
export function StaffShell({ children, title, actions }: { children: React.ReactNode; title?: string; actions?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isOn = (href: string) => path === href || (href !== "/hub" && path.startsWith(href + "/"));
  const current = ALL_NAV.find(([h]) => isOn(h))?.[1];
  return (
    <div className="min-h-dvh bg-[#f7f7f8] lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className={cn("fixed inset-0 z-40 flex-col border-r border-[#efe6df] bg-[#f7f7f8] lg:sticky lg:top-0 lg:flex lg:h-dvh", open ? "flex" : "hidden")}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#efe6df] px-5">
          <Link href="/hub" onClick={() => setOpen(false)}><Logo small /></Link>
          <button type="button" className="text-subtitle text-ink-muted lg:hidden" onClick={() => setOpen(false)}>Close</button>
        </div>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((g) => (
            <div key={g.label} className="mb-4">
              <p className="px-3 pb-1 text-[12px] text-ink-muted">{g.label}</p>
              {g.items.map(([href, label]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={isOn(href) ? "page" : undefined}
                  className={cn("flex h-10 items-center rounded-ds-xsm px-3 text-subtitle transition-colors",
                    isOn(href) ? "bg-brand-tint font-medium text-brand-strong" : "text-ink-body hover:bg-white")}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <p className="border-t border-[#efe6df] px-5 py-4 text-[11px] leading-snug text-ink-muted">
          Prototype · MoldFlow assists qualified inspectors; it does not identify, diagnose or confirm mold. Sending, booking and CRM sync are simulated; people marked &ldquo;synthetic&rdquo; are invented demo data.
        </p>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[#efe6df] bg-[#f7f7f8]/95 px-5 backdrop-blur lg:px-7">
          <button type="button" onClick={() => setOpen(true)} className="rounded-ds-xsm border border-[#efe6df] px-3 py-1.5 text-subtitle lg:hidden">Menu</button>
          <p className="min-w-0 truncate text-subtitle font-medium text-ink-body">MoldFlow <span className="text-ink-muted">/</span> {current ?? title ?? "Hub"}</p>
          <div className="ml-auto flex shrink-0 items-center gap-2">{actions}<HubSearch /><PauseButton /><QrLink /></div>
        </header>
        <main className="mx-auto max-w-[88rem] px-5 py-7 lg:px-7">
          {title && <h1 className="mb-6 text-[24px] font-semibold leading-tight text-ink">{title}</h1>}
          {children}
        </main>
      </div>
    </div>
  );
}

export function QrLink() {
  const [src, setSrc] = useState<string>();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/`;
    QRCode.toDataURL(u, { margin: 1, width: 360, color: { dark: "#0F142A", light: "#FFFFFF" } }).then((s) => { setSrc(s); setUrl(u); });
  }, []);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Customer link / QR" aria-label="Customer link / QR"
        className="grid h-10 w-10 place-items-center rounded-ds-xsm border border-brand/40 text-brand hover:bg-brand-tint"><QrCode size={16} aria-hidden /></button>
      <Modal open={open} onClose={() => setOpen(false)} title="Scan to start a pre-assessment">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {src && <img src={src} alt="QR code" className="mx-auto h-72 w-72" />}
          <p className="mt-3 text-caption text-ink-muted">{url}</p>
        </div>
      </Modal>
    </>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-subtitle text-ink-body">
      <Loader size={16} label={label ?? "Loading"} />
      {label}
    </span>
  );
}

export function LangToggle({ lang, onChange }: { lang: "en" | "fr"; onChange: (l: "en" | "fr") => void }) {
  return (
    <Tabs variant="pill" label="Language" value={lang} onChange={(id) => onChange(id as "en" | "fr")}
      items={[{ id: "en", label: "EN" }, { id: "fr", label: "FR" }]} className="bg-white shadow-ds-xsm" />
  );
}
