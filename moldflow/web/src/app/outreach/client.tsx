"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCheck, Lock, Send, Trash2 } from "lucide-react";
import { api, money } from "@/lib/api";
import { Button, Card, EmptyState, Spinner, StaffShell, Tag, cx } from "@/components/ui";
import { ByTag, SyntheticTag, dayTime, type MessageRow, type Task } from "@/components/hub";

const TRIGGER: Record<string, string> = { estimate_chase: "Estimate follow-up", inbound_reply: "Reply", faq_reply: "Instant reply", storm_offer: "Storm check-in (offer)",
  storm_safety: "Storm safety (no offer)", manual: "Written by staff" };
const label = (t: string) => TRIGGER[t] ?? (t.startsWith("moment:") ? `Moment: ${t.split(":")[1].replace(/_/g, " ")}` : t);
const TABS = [["draft", "To approve"], ["blocked", "Blocked"], ["approved", "Held"], ["sent_simulated", "Sent"], ["received", "Inbound"], ["tasks", "Calls & tasks"]] as const;

export default function Outreach() {
  const sp = useSearchParams();
  const initial = (sp.get("tab") as string) || "draft";
  const [tab, setTab] = useState<string>(TABS.some(([k]) => k === initial) ? initial : "draft");
  const [rows, setRows] = useState<MessageRow[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<string | null>(null);
  const load = useCallback(() => (tab === "tasks"
    ? api.get<Task[]>("/tasks").then((t) => { setTasks(t); setRows([]); })
    : api.get<MessageRow[]>(`/messages?status=${tab}`).then(setRows)), [tab]);
  useEffect(() => { load(); }, [load]);
  const groups = useMemo(() => {
    const g: Record<string, MessageRow[]> = {};
    for (const r of rows ?? []) (g[label(r.message.trigger)] ??= []).push(r);
    return g;
  }, [rows]);
  const safe = (rows ?? []).filter((r) => r.message.autonomy !== "locked").map((r) => r.message.id);
  const batch = async (ids: string[]) => {
    const r = await api.post<{ sent: number; blocked: number; held: number }>("/messages/approve-batch", { ids, by: "Staff E" });
    setResult(`${r.sent} sent · ${r.held} held for quiet hours · ${r.blocked} blocked by consent rules`);
    setSel(new Set());
    load();
  };

  return (
    <StaffShell title="Outreach">
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setRows(null); setResult(null); }} aria-pressed={tab === k}
            className={cx("h-10 rounded-full px-4 text-subtitle", tab === k ? "bg-brand text-white" : "bg-white text-ink-body shadow-ds-xsm")}>{l}</button>
        ))}
      </div>
      {result && <p role="status" className="mb-4 rounded-ds-sm bg-alert-success-bg p-3 text-subtitle text-ink">{result}</p>}
      {!rows ? <Spinner label="Loading…" /> : tab === "tasks" ? (
        <Card className="divide-y divide-kit-gray-soft">
          {tasks.length === 0 && <div className="p-6"><EmptyState title="No calls or tasks" /></div>}
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-4">
              <div><Tag tone={t.kind === "escalation" ? "red" : "brand"} soft>{t.kind.replace("_", " ")}</Tag>
                <p className="mt-1 text-subtitle text-ink">{t.contact_id ? <Link href={`/people/${t.contact_id}`} className="hover:text-brand">{t.title}</Link> : t.title}</p></div>
              <Button size="sm" variant="outline" onClick={async () => { await api.post(`/tasks/${t.id}/done`); load(); }}>Done</Button>
            </div>
          ))}
        </Card>
      ) : rows.length === 0 ? <Card className="p-6"><EmptyState title="Nothing here" /></Card> : (
        <>
          {tab === "draft" && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button leading={<CheckCheck size={16} aria-hidden />} disabled={!safe.length} onClick={() => batch(safe)}>Approve all without money ({safe.length})</Button>
              <Button variant="outline" disabled={!sel.size} onClick={() => batch([...sel])}>Approve selected ({sel.size})</Button>
              <p className="text-caption text-ink-muted">Messages with a dollar amount or personal facts always need one-by-one approval.</p>
            </div>
          )}
          <div className="space-y-6">
            {Object.entries(groups).map(([g, list]) => (
              <section key={g}>
                <h2 className="mb-2 text-subheading font-semibold text-ink">{g} <span className="text-ink-muted">({list.length})</span></h2>
                <div className="space-y-2">{list.map((r) => <Row key={r.message.id} r={r} tab={tab} checked={sel.has(r.message.id)}
                  onCheck={() => setSel((s) => { const n = new Set(s); if (n.has(r.message.id)) n.delete(r.message.id); else n.add(r.message.id); return n; })}
                  onDone={(msg) => { setResult(msg); load(); }} />)}</div>
              </section>
            ))}
          </div>
        </>
      )}
    </StaffShell>
  );
}

function Row({ r, tab, checked, onCheck, onDone }: { r: MessageRow; tab: string; checked: boolean; onCheck: () => void; onDone: (m: string) => void }) {
  const m = r.message;
  const [body, setBody] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const locked = m.autonomy === "locked";
  const approve = async () => {
    setBusy(true);
    const out = await api.post<{ status: string; blocked_reason?: string }>(`/messages/${m.id}/approve`, { by: "Staff E", body });
    setBusy(false);
    onDone(out.status === "sent_simulated" ? `Sent to ${r.contact_name} (simulated)` : `${r.contact_name}: ${out.blocked_reason}`);
  };
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        {tab === "draft" && !locked && <input type="checkbox" checked={checked} onChange={onCheck} aria-label={`Select message to ${r.contact_name}`} className="mt-1.5 h-5 w-5 accent-[var(--color-brand)]" />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-caption text-ink-muted">
            <Link href={`/people/${m.contact_id}`} className="text-subtitle font-medium text-ink hover:text-brand">{m.direction === "in" ? "From " : "To "}{r.contact_name}</Link>
            <SyntheticTag show={r.contact_synthetic} /> · {m.channel.toUpperCase()} · {m.language.toUpperCase()} · {dayTime(m.created_at)}
            <ByTag by={m.drafted_by} />
            {!m.is_cem && m.direction === "out" && <Tag tone="gray" soft>not marketing</Tag>}
            {locked && <Tag tone="orange" soft className="gap-1"><Lock size={11} aria-hidden />needs you{m.amount ? ` · ${money(m.amount)}` : ""}</Tag>}
          </p>
          {tab === "draft" ? (
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={Math.min(5, Math.ceil(body.length / 90) + 1)} aria-label="Message text"
              className="mt-2 w-full rounded-ds-xsm border border-kit-gray-soft p-2 text-subtitle text-ink focus:border-brand focus:outline-none" />
          ) : <p className="mt-2 whitespace-pre-line text-subtitle text-ink">{m.final_body ?? m.body}</p>}
          <p className="mt-1 text-caption text-ink-muted">Why: {m.reason}{m.facts_used.length ? ` · uses ${m.facts_used.length} fact(s)` : ""}{m.channel === "sms" && tab === "draft" ? ` · ${body.length} chars + footer` : ""}</p>
          {m.blocked_reason && <p className="mt-1 text-caption font-medium text-kit-red">{m.blocked_reason}</p>}
          <Earlier contactId={m.contact_id} beforeId={m.id} />
        </div>
        {tab === "draft" && (
          <div className="flex shrink-0 gap-1">
            <Button size="sm" leading={<Send size={14} aria-hidden />} disabled={busy} onClick={approve}>{m.amount ? `Approve & send (${money(m.amount)})` : "Approve & send"}</Button>
            <button aria-label="Discard draft" onClick={async () => { await api.post(`/messages/${m.id}/discard`); onDone("Draft discarded"); }}
              className="grid h-9 w-9 place-items-center rounded-ds-xsm text-ink-muted hover:bg-alert-danger-bg hover:text-kit-red"><Trash2 size={15} /></button>
          </div>
        )}
      </div>
    </Card>
  );
}

type Earlier = { id: string; dir: "in" | "out"; text: string; at: string };
/** Context for a draft: load the previous 3 messages with this customer, and keep loading further back. */
function Earlier({ contactId, beforeId }: { contactId: string; beforeId: string }) {
  const [rows, setRows] = useState<Earlier[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const pivot = rows[0]?.id ?? beforeId;
      const r = await api.get<{ messages: Earlier[]; has_more: boolean }>(`/threads/${contactId}?before=${encodeURIComponent(pivot)}&limit=3`);
      setRows((x) => [...r.messages, ...x]); setMore(r.has_more);
    } finally { setBusy(false); }
  }
  return (
    <div className="mt-3 border-t border-[#efe6df] pt-2">
      {rows.length > 0 && (
        <ol className="mb-2 space-y-1.5">
          {rows.map((x) => (
            <li key={x.id} className={cx("w-fit max-w-[90%] rounded-ds-xsm px-2.5 py-1.5 text-[13px]", x.dir === "in" ? "bg-kit-gray-faint text-ink" : "ml-auto bg-brand-tint text-ink")}>
              {x.text}<span className="mt-0.5 block text-[11px] text-ink-muted">{x.dir === "in" ? "Customer" : "Mold Busters"} · {dayTime(x.at)}</span>
            </li>
          ))}
        </ol>
      )}
      {more ? (
        <button type="button" onClick={() => void load()} disabled={busy} className="text-[13px] font-medium text-brand hover:underline disabled:opacity-60">
          {busy ? "Loading…" : rows.length ? "Load 3 more earlier messages" : "Load previous 3 messages"}
        </button>
      ) : <p className="text-[12px] text-ink-muted">Start of the conversation.</p>}
    </div>
  );
}
