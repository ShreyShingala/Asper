"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Eye, FastForward, MessageSquare, RotateCcw, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, Spinner, StaffShell, Tag, TextArea, cx } from "@/components/ui";

type CardT = { id: string; case_id: string; case_title: string; kind: string; label: string; title: string; to: string; channel: string;
  body: string; reason: string; action: "approve" | "watch" | "open"; link?: string; created_at: string; minutes: number };
type Inbox = { cards: CardT[]; today: string; stats: { approved: number; minutes_saved_estimate: number; sent_on_behalf_of_tenants: number } };

export default function Autopilot() {
  const [d, setD] = useState<Inbox | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => api.get<Inbox>("/autopilot/inbox").then(setD).catch((e: Error) => setErr(e.message)), []);
  useEffect(() => { void load(); }, [load]);

  async function run(key: string, path: string, body: object) {
    setBusy(key); setErr(null);
    try { await api.post(path, body); setEdit(null); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  const approve = d?.cards.filter((c) => c.action === "approve") ?? [];
  const other = d?.cards.filter((c) => c.action !== "approve") ?? [];
  const kinds = [...new Set(approve.map((c) => c.kind))].filter((k) => approve.filter((c) => c.kind === k).length > 1);

  return (
    <StaffShell title="Autopilot" actions={
      <Button size="sm" variant="outline" leading={<FastForward size={14} aria-hidden />} state={busy === "skip" ? "loading" : undefined}
        onClick={() => void run("skip", "/demo/skip", { days: 7 })}>Skip 7 days</Button>}>
      {!d ? <Spinner label="Drafting next actions…" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[[approve.length, "waiting for your OK"], [d.stats.approved, "approved and sent"], [`~${d.stats.minutes_saved_estimate} min`, "admin time saved (estimate)"],
              [d.stats.sent_on_behalf_of_tenants, "tenant letters sent"]].map(([v, k]) => (
              <Card key={String(k)} className="p-5"><p className="text-h5 font-semibold tabular-nums text-ink">{v}</p><p className="mt-1 text-caption font-light text-ink-body">{k}</p></Card>
            ))}
          </div>
          <p className="mt-3 text-caption font-light text-ink-muted">The system drafts every next step from the case records. Nothing is sent until someone approves it. Sending is simulated. Demo date: {d.today}.</p>
          {err && <p role="alert" className="mt-3 rounded-ds-sm bg-alert-danger-bg p-3 text-subtitle text-kit-red">{err}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-subheading font-semibold text-ink">Needs your OK ({approve.length})</h2>
            <div className="flex flex-wrap gap-2">
              {kinds.map((k) => (
                <Button key={k} size="sm" leading={<Check size={14} aria-hidden />} state={busy === `all-${k}` ? "loading" : undefined}
                  onClick={() => void run(`all-${k}`, "/autopilot/approve-all", { kind: k })}>
                  Approve all {approve.filter((c) => c.kind === k).length} · {approve.find((c) => c.kind === k)?.label}
                </Button>
              ))}
            </div>
          </div>
          {approve.length === 0 && <div className="mt-3"><EmptyState title="All caught up" description="New drafts appear here as cases move." /></div>}
          <ul className="mt-3 space-y-3">
            {approve.map((c) => (
              <li key={c.id}>
                <Card className="overflow-hidden">
                  <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                    <Tag tone="brand" soft>{c.label}</Tag>
                    <div className="min-w-0 flex-1">
                      <p className="text-subtitle font-semibold text-ink">{c.title}</p>
                      <p className="text-caption text-ink-muted"><Link href={`/projects/${c.case_id}`} className="underline">{c.case_title}</Link> · {c.channel} to {c.to}</p>
                      <p className="mt-1 text-caption text-ink-body">Why: {c.reason}</p>
                    </div>
                    <span className="flex items-center gap-1 text-caption text-ink-muted"><Clock size={12} aria-hidden />~{c.minutes} min</span>
                  </div>
                  {edit === c.id ? (
                    <div className="px-5 pb-3"><TextArea aria-label="Edit draft" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} /></div>
                  ) : (
                    <p className="mx-5 mb-3 whitespace-pre-wrap rounded-ds-xsm bg-kit-gray-faint p-3 text-subtitle text-ink">{c.body}</p>
                  )}
                  <div className="flex flex-wrap gap-2 border-t border-kit-gray-soft px-5 py-3">
                    <Button size="sm" leading={<Send size={14} aria-hidden />} state={busy === c.id ? "loading" : undefined}
                      onClick={() => void run(c.id, "/autopilot/approve", { case_id: c.case_id, id: c.id, body: edit === c.id ? draft : undefined })}>Approve and send</Button>
                    {edit === c.id ? <Button size="sm" variant="outline" leading={<RotateCcw size={14} aria-hidden />} onClick={() => setEdit(null)}>Cancel edit</Button>
                      : <Button size="sm" variant="outline" onClick={() => { setEdit(c.id); setDraft(c.body); }}>Edit</Button>}
                    <Button size="sm" variant="text" leading={<X size={14} aria-hidden />} onClick={() => void run(`d-${c.id}`, "/autopilot/deny", { case_id: c.case_id, id: c.id, reason: "Denied by owner" })}>Deny</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          {other.length > 0 && (
            <>
              <h2 className="mt-8 text-subheading font-semibold text-ink">Running on its own ({other.length})</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {other.map((c) => (
                  <li key={c.id}>
                    <Card className={cx("h-full p-4", c.action === "open" && "border-l-4 border-l-brand")}>
                      <div className="flex items-center gap-2"><Tag tone={c.action === "open" ? "brand" : "gray"} soft>{c.label}</Tag>
                        <span className="truncate text-caption text-ink-muted">{c.case_title}</span></div>
                      <p className="mt-2 text-subtitle font-medium text-ink">{c.title}</p>
                      <p className="mt-1 text-caption text-ink-body">{c.reason}</p>
                      <div className="mt-3 flex gap-2">
                        {c.link ? <Link href={c.link} className="inline-flex items-center gap-1 text-subtitle font-medium text-brand underline"><Eye size={14} aria-hidden />Open</Link>
                          : <Link href={`/projects/${c.case_id}`} className="inline-flex items-center gap-1 text-subtitle font-medium text-brand underline"><MessageSquare size={14} aria-hidden />Project</Link>}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </StaffShell>
  );
}
