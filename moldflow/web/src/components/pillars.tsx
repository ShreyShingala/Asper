"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ClipboardCheck, MessageSquare, Video, X } from "lucide-react";
import { api, photoUrl } from "@/lib/api";
import { Button, Card, Tag, cx } from "@/components/ui";
import { OnsiteVideo } from "@/components/onsite-video";

type Conv = { contact_id: string; name: string; language: string; synthetic: boolean; owner: string; case_id?: string | null; last_at: string;
  thread: { id: string; dir: "in" | "out"; text: string; at: string; status: string }[];
  draft: { id: string; body: string; reason: string; autonomy: string } | null };
type Virtual = { case_id: string; title: string; stage: string; photos: number; service?: string | null; summary?: string | null; paid: string[];
  tenant_pack?: string | null; photo_ids: string[]; pending: { id: string; body: string; reason: string }[] };
type Onsite = { case_id: string; title: string; stage: string; notes: number; findings: number; inspector_photos: number; last_note?: string | null;
  has_video: boolean; report: "approved" | "draft" | "none"; blocks: string[]; summary?: string | null };
type Pillars = { conversations: Conv[]; virtual: Virtual[]; onsite: Onsite[]; counts: { replies_waiting: number; virtual_waiting: number; reports_waiting: number } };

/** The admin's three pillars. The system does the work; each card ends in Approve or Deny. */
export function Pillars() {
  const [d, setD] = useState<Pillars | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState({ conversations: false, virtual: false, onsite: false });
  const more = (k: keyof typeof open, n: number) => n > 3 && (
    <button type="button" onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} className="mt-3 w-full rounded-ds-sm border border-kit-gray-soft py-2 text-caption font-medium text-brand hover:bg-brand-tint/40">
      {open[k] ? "Show less" : `View ${n - 3} more`}</button>
  );
  const load = useCallback(() => api.get<Pillars>("/hub/pillars").then(setD), []);
  useEffect(() => { void load(); }, [load]);
  const act = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key); setMsg(null);
    try { await fn(); setMsg(done); await load(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(null); }
  };
  const approve = (id: string) => act(id, () => api.post(`/messages/${id}/approve`, { by: "Owner" }), "Approved and sent (simulated).");
  const deny = (id: string) => act(`x${id}`, () => api.post(`/messages/${id}/discard?by=Owner`), "Draft denied.");
  if (!d) return null;

  return (
    <section aria-label="Pillars" className="mb-8 space-y-4">
      {msg && <p role="status" className="rounded-ds-sm bg-alert-success-bg p-3 text-subtitle text-alert-success-title ">{msg}</p>}

      <Card className="flex flex-col p-5">
        <Head icon={<ClipboardCheck size={18} aria-hidden />} title="On-site reviews" n={d.counts.reports_waiting} sub="upload the visit's walkthrough video: it fills out the report" />
        <div className="mt-3"><OnsiteVideo /></div>
      </Card>

      <Card className="flex flex-col p-5">
        <Head icon={<MessageSquare size={18} aria-hidden />} title="Customer conversations" n={d.counts.replies_waiting} sub="replies drafted from their case" />
        <ul className="mt-3 space-y-3">
          {d.conversations.slice(0, open.conversations ? undefined : 3).map((c) => (
            <li key={c.contact_id} className="rounded-ds-sm border border-kit-gray-soft p-3">
              <div className="flex items-center gap-2">
                <Link href={`/people/${c.contact_id}`} className="text-subtitle font-semibold text-ink underline-offset-2 hover:underline">{c.name}</Link>
                {c.synthetic && <Tag tone="gray" soft>synthetic</Tag>}
                <span className="ml-auto text-[11px] text-ink-muted">{new Date(c.last_at).toLocaleString()}</span>
              </div>
              <ol className="mt-2 space-y-1">
                {c.thread.slice(-3).map((m) => (
                  <li key={m.id} className={cx("w-fit max-w-[92%] rounded-ds-xsm px-2.5 py-1.5 text-[13px]", m.dir === "in" ? "bg-kit-gray-faint text-ink" : "ml-auto bg-brand-tint text-ink")}>{m.text}</li>
                ))}
              </ol>
              {c.draft && (
                <div className="mt-2 rounded-ds-xsm border border-brand/30 bg-white p-2.5">
                  <p className="text-[11px] font-semibold uppercase text-brand-strong">AI draft · {c.draft.reason}</p>
                  <p className="mt-1 text-[14px] text-ink">{c.draft.body}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" leading={<Check size={14} aria-hidden />} state={busy === c.draft.id ? "loading" : undefined} onClick={() => void approve(c.draft!.id)}>Approve</Button>
                    <Button size="sm" variant="text" leading={<X size={14} aria-hidden />} onClick={() => void deny(c.draft!.id)}>Deny</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        {more("conversations", d.conversations.length)}
      </Card>

      <Card className="flex flex-col p-5">
        <Head icon={<Video size={18} aria-hidden />} title="Virtual assessments" n={d.counts.virtual_waiting} sub="live calls and photo intakes, filed automatically" />
        {d.virtual.length === 0 && <p className="mt-3 text-caption text-ink-muted">New virtual assessments appear here the moment a customer finishes the live call.</p>}
        <ul className="mt-3 space-y-3">
          {d.virtual.slice(0, open.virtual ? undefined : 3).map((v) => (
            <li key={v.case_id} className="rounded-ds-sm border border-kit-gray-soft p-3">
              <div className="flex items-center gap-2">
                <Link href={`/projects/${v.case_id}`} className="text-subtitle font-semibold text-ink hover:underline">{v.title}</Link>
                <Tag tone="gray" soft>{v.stage.replace("_", " ")}</Tag>
              </div>
              {v.photo_ids.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.photo_ids.map((pid) => <img key={pid} src={photoUrl(v.case_id, pid)} alt="" className="h-12 w-12 rounded-ds-xsm object-cover" />)}
                </div>
              )}
              {v.service && <p className="mt-2 text-caption text-ink"><b>Recommended:</b> {v.service}</p>}
              {v.summary && <p className="mt-1 line-clamp-2 text-caption text-ink-body">{v.summary}</p>}
              <div className="mt-1 flex flex-wrap gap-1.5">
                {v.paid.map((p) => <Tag key={p} tone="green" soft>paid · {p.replace("_", " ")}</Tag>)}
                {v.tenant_pack && <Tag tone="brand" soft>tenant pack · {v.tenant_pack}</Tag>}
              </div>
              {v.pending.map((m) => (
                <div key={m.id} className="mt-2 rounded-ds-xsm border border-brand/30 p-2.5">
                  <p className="text-[11px] font-semibold uppercase text-brand-strong">{m.reason}</p>
                  <p className="mt-1 text-caption text-ink">{m.body}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" leading={<Check size={14} aria-hidden />} onClick={() => void approve(m.id)}>Approve</Button>
                    <Button size="sm" variant="text" leading={<X size={14} aria-hidden />} onClick={() => void deny(m.id)}>Deny</Button>
                  </div>
                </div>
              ))}
            </li>
          ))}
        </ul>
        {more("virtual", d.virtual.length)}
        <Link href="/?demo=1" className="mt-3 text-caption font-medium text-brand underline">Start a virtual assessment (demo)</Link>
      </Card>

    </section>
  );
}

function Head({ icon, title, n, sub }: { icon: React.ReactNode; title: string; n: number; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-ink-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="text-subheading font-semibold text-ink">{title}</h2>
        <p className="text-caption text-ink-muted">{sub}</p>
      </div>
      {n > 0 && <span className="rounded-full bg-brand px-2.5 py-0.5 text-caption font-semibold text-white">{n} to approve</span>}
    </div>
  );
}
