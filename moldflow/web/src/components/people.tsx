"use client";
import Link from "next/link";
import { CalendarClock, MapPin, MessageSquare, Phone } from "lucide-react";
import { photoUrl } from "@/lib/api";
import { Card, Tag, cx } from "@/components/ui";

export type Person = {
  id: string; name: string; language: string; type: string; synthetic: boolean; owner: string; phone: string; email: string;
  address: string; postal: string; lat: number | null; lon: number | null; drafts: number; last_at: string | null;
  case: { id: string; title: string; stage: string; concern: string; project_no?: number | null; photos: string[]; photo_count: number; findings: number;
    service?: string | null; visit?: string | null; estimate?: string | null; paid: string[] } | null;
  messages: { id: string; dir: "in" | "out"; text: string; at: string; status: string }[];
  facts: { id: string; text: string; category: string; status: string; quote: string; learned: string }[];
  followups: { id: string; due: string; reason: string; status: string }[];
};

const when = (s: string) => new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Everything about one customer: location, case, photos, conversation, what we learned, next follow-up. */
export function Conversation({ p, tall }: { p: Person; tall?: boolean }) {
  return (
    <ol className={cx("space-y-1.5 overflow-y-auto pr-1", tall ? "max-h-[28rem]" : "max-h-72")}>
      {p.messages.map((m) => (
        <li key={m.id} className={cx("w-fit max-w-[90%] rounded-ds-xsm px-2.5 py-1.5 text-caption", m.dir === "in" ? "bg-kit-gray-faint text-ink" : "ml-auto bg-brand-tint text-ink",
          m.status === "draft" && "border border-dashed border-brand")}>
          {m.status === "draft" && <b className="block text-[11px] uppercase text-brand-strong">AI draft · waiting for approval</b>}
          {m.text}<span className="mt-0.5 block text-[11px] text-ink-muted">{when(m.at)}</span>
        </li>
      ))}
    </ol>
  );
}

export function Learned({ p }: { p: Person }) {
  return (
    <ul className="space-y-1">{p.facts.map((f) => (
      <li key={f.id} className="text-caption text-ink-body">• {f.text} {f.status === "pending" && <Tag tone="brand" soft>new</Tag>}
        <span className="block pl-2 text-[11px] italic text-ink-muted">&ldquo;{f.quote}&rdquo;</span></li>
    ))}{p.facts.length === 0 && <li className="text-caption text-ink-muted">Nothing yet.</li>}</ul>
  );
}

export function PersonPanel({ p, compact }: { p: Person; compact?: boolean }) {
  const next = p.followups.find((f) => f.status === "upcoming");
  return (
    <Card className="space-y-4 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/people/${p.id}`} className="text-subheading font-semibold text-ink hover:underline">{p.name}</Link>
          <Tag tone="gray" soft>{p.type.replace("_", " ")}</Tag>
          <Tag tone="gray" soft>{p.language === "fr" ? "Français" : "English"}</Tag>
          {p.synthetic && <Tag tone="gray" soft>synthetic</Tag>}
          {p.drafts > 0 && <Tag tone="brand" soft>{p.drafts} reply to approve</Tag>}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-3 text-caption text-ink-muted">
          <span className="flex items-center gap-1"><MapPin size={12} aria-hidden />{p.address} · {p.postal}</span>
          <span className="flex items-center gap-1"><Phone size={12} aria-hidden />{p.phone}</span>
        </p>
      </div>
      {p.case && (
        <div className="rounded-ds-sm bg-kit-gray-faint p-3 text-subtitle">
          <p className="font-medium text-ink"><Link href={`/projects/${p.case.id}`} className="hover:underline">#{p.case.project_no ?? p.case.id} · {p.case.title}</Link>
            <span className="ml-2 text-caption text-ink-muted">{p.case.stage.replace("_", " ")}</span></p>
          <p className="mt-1 text-caption text-ink-body">{p.case.concern}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 text-caption text-ink-body">
            {p.case.visit && <span>Visit: {p.case.visit}</span>}{p.case.estimate && <span>Estimate: {p.case.estimate}</span>}
            {p.case.service && <span>Recommended: {p.case.service}</span>}<span>{p.case.photo_count} photos · {p.case.findings} findings</span>
          </div>
          {p.case.photos.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.case.photos.slice(0, compact ? 3 : 6).map((id) => <img key={id} src={photoUrl(p.case!.id, id)} alt="" className="h-14 w-14 shrink-0 rounded-ds-xsm object-cover" />)}
            </div>
          )}
        </div>
      )}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-caption font-semibold text-ink"><MessageSquare size={13} aria-hidden />Conversation</p>
        <ol className={cx("space-y-1.5 overflow-y-auto pr-1", compact ? "max-h-44" : "max-h-72")}>
          {p.messages.map((m) => (
            <li key={m.id} className={cx("w-fit max-w-[90%] rounded-ds-xsm px-2.5 py-1.5 text-caption", m.dir === "in" ? "bg-kit-gray-faint text-ink" : "ml-auto bg-brand-tint text-ink",
              m.status === "draft" && "border border-dashed border-brand")}>
              {m.status === "draft" && <b className="block text-[11px] uppercase text-brand-strong">AI draft · waiting for approval</b>}
              {m.text}<span className="mt-0.5 block text-[11px] text-ink-muted">{when(m.at)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-caption font-semibold text-ink">What we&apos;ve learned ({p.facts.length})</p>
          <ul className="space-y-1">{p.facts.map((f) => (
            <li key={f.id} className="text-caption text-ink-body">• {f.text} {f.status === "pending" && <Tag tone="brand" soft>new</Tag>}
              <span className="block pl-2 text-[11px] italic text-ink-muted">&ldquo;{f.quote}&rdquo;</span></li>
          ))}</ul>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1 text-caption font-semibold text-ink"><CalendarClock size={13} aria-hidden />Follow-ups</p>
          <ul className="space-y-1">{p.followups.map((f) => (
            <li key={f.id} className={cx("text-caption", f.status === "upcoming" ? "text-ink" : "text-ink-muted line-through")}>{f.due} · {f.reason}</li>
          ))}</ul>
          {next && <p className="mt-1 text-[11px] text-brand-strong">Next: {next.due}</p>}
        </div>
      </div>
    </Card>
  );
}
