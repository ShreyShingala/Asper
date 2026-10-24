"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bot, Check, Hand, Lightbulb, Mail, MessageSquare, NotebookPen, Pencil, Phone, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { api, money } from "@/lib/api";
import { Button, Card, KitTextarea, Spinner, StaffShell, Tag, cx } from "@/components/ui";
import { ByTag, OwnerBadge, SourceChip, SyntheticTag, day, dayTime, type PersonView, type ProfileFact } from "@/components/hub";

const CAT: Record<string, string> = { home: "Home", household: "Household", life_event: "Life event", preference: "Preference", health: "Health", work: "Work", other: "Other" };
const HOW: Record<string, string> = { call: "on a call", bruce: "to Bruce", sms: "by text", email: "by email", note: "staff note", form: "on a form", booking: "when booking", import: "imported" };
const FILTERS = [["all", "All"], ["msg", "Messages"], ["call", "Calls"], ["money", "Money"], ["job", "Jobs"]] as const;

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<PersonView | null>(null);
  const [points, setPoints] = useState<{ points: string[]; by: string } | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const load = useCallback(() => api.get<PersonView>(`/people/${id}`).then(setV), [id]);
  useEffect(() => { load(); }, [load]);
  if (!v) return <StaffShell><Spinner label="Loading…" /></StaffShell>;
  const c = v.contact;
  const prop = c.properties[0];
  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try { await fn(); await load(); if (done) setFlash(done); } catch (e) { setFlash(String(e)); } finally { setBusy(null); }
  };
  const pending = v.facts.filter((f) => f.status === "pending");
  const approved = v.facts.filter((f) => f.status === "approved");
  const openEst = v.timeline.find((i) => i.kind === "estimate" && ["sent", "viewed"].includes(i.meta?.status ?? ""));
  const tl = v.timeline.filter((i) => filter === "all" || (filter === "msg" ? ["sms", "email", "close"].includes(i.system) : filter === "call" ? i.system === "dialpad" || i.kind === "call"
    : filter === "money" ? i.system === "freshbooks" : ["google_calendar", "moldflow", "asana"].includes(i.system)));

  return (
    <StaffShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/people" className="text-caption text-ink-muted hover:text-brand">← People</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-h5 font-semibold text-ink">{c.name} <SyntheticTag show={c.synthetic} /></h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-subtitle text-ink-body">
            <span className="capitalize">{c.customer_type.replace("_", " ")}</span>
            {c.phones[0] && <span className="inline-flex items-center gap-1"><Phone size={13} aria-hidden />{c.phones[0]}</span>}
            {c.emails[0] && <span className="inline-flex items-center gap-1"><Mail size={13} aria-hidden />{c.emails[0]}</span>}
            {prop && <span>{prop.address}, {prop.city} {prop.postal}</span>}
            <span className="uppercase">{c.language}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OwnerBadge owner={c.owner} />
          {c.owner.startsWith("human")
            ? <Button size="sm" variant="outline" leading={<Bot size={14} aria-hidden />} onClick={() => act("own", () => api.patch(`/people/${id}`, { owner: "ai" }), "Handed back to the AI")}>Hand back to AI</Button>
            : <Button size="sm" variant="outline" leading={<Hand size={14} aria-hidden />} onClick={() => act("own", () => api.patch(`/people/${id}`, { owner: "human:Staff E" }), "You're handling this thread; the AI will only draft")}>Take over</Button>}
          {openEst && <Button size="sm" disabled={busy === "chase"} onClick={() => act("chase", () => api.post(`/people/${id}/chase`), "Follow-up drafted: approve it in Outreach")}>Draft estimate follow-up</Button>}
        </div>
      </div>
      {flash && <p role="status" className="mb-4 rounded-ds-sm bg-brand-tint p-3 text-subtitle text-brand-strong">{flash}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-brand/30 bg-brand-tint/40 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><Lightbulb size={18} className="text-brand" aria-hidden />Talking points for your next call</h2>
              <Button size="sm" variant="text" leading={<Sparkles size={14} aria-hidden />} disabled={busy === "pts"}
                onClick={() => act("pts", async () => setPoints(await api.post(`/people/${id}/talking-points`)))}>Rewrite with AI</Button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {(points?.points ?? v.talking_points).map((p, i) => <li key={i} className="flex gap-2 text-subtitle text-ink"><span className="text-brand">•</span>{p}</li>)}
            </ul>
            <p className="mt-2 flex items-center gap-1.5 text-caption text-ink-muted"><ByTag by={points?.by ?? v.talking_points_by} />Health details are never shown here.</p>
          </Card>

          {openEst && (
            <Card tone="warning" className="flex flex-wrap items-center gap-3 p-4">
              <p className="flex-1 text-subtitle text-ink">Estimate <b>{openEst.meta?.number}</b> · {money(openEst.amount)} · <b>{openEst.meta?.status}</b>, not accepted · sent {day(openEst.at)}</p>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-subheading font-semibold text-ink">What we know</h2>
              {pending.length > 0 && <Tag tone="brand" soft>{pending.length} to check</Tag>}
            </div>
            <p className="text-caption text-ink-muted">Every fact keeps the customer&apos;s own words and where they said it. Home and preference facts approve themselves; household, health and life events wait for you.</p>
            <ul className="mt-3 divide-y divide-kit-gray-soft">
              {[...pending, ...approved].map((f) => <FactRow key={f.id} f={f} onChange={load} />)}
              {v.facts.length === 0 && <li className="py-3 text-subtitle text-ink-muted">Nothing yet. Notes, calls and replies add facts automatically.</li>}
            </ul>
            <div className="mt-4 rounded-ds-sm bg-kit-gray-faint p-3">
              <KitTextarea label="Add a note or after-call summary" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="e.g. Called her back. They're finishing the basement in the spring and want texts after 5." />
              <div className="mt-2 flex gap-2">
                <Button size="sm" leading={<NotebookPen size={14} aria-hidden />} disabled={!note.trim() || busy === "note"}
                  onClick={() => act("note", async () => { const r = await api.post<{ facts: unknown[] }>(`/people/${id}/notes`, { text: note, kind: "call", by: "Staff E" }); setNote(""); setFlash(`Saved. ${r.facts.length} new fact(s) extracted.`); })}>
                  Save after-call note</Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-subheading font-semibold text-ink">Everything, one timeline</h2>
              <div className="flex gap-1">
                {FILTERS.map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
                    className={cx("rounded-full px-3 py-1 text-caption", filter === k ? "bg-ink text-white" : "bg-kit-gray-faint text-ink-body")}>{l}</button>
                ))}
              </div>
            </div>
            <ol className="mt-3 space-y-3">
              {tl.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <span className="w-24 shrink-0 text-caption tabular-nums text-ink-muted">{dayTime(i.at)}</span>
                  <div className="min-w-0">
                    <SourceChip system={i.system} />
                    <p className="mt-0.5 text-subtitle text-ink-body">{i.summary}{i.amount ? ` · ${money(i.amount)}` : ""}
                      {i.meta?.status && <span className="ml-1.5"><Tag tone={i.meta.status === "accepted" ? "green" : "orange"} soft>{i.meta.status}</Tag></span>}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-subheading font-semibold text-ink">Write to {c.name.startsWith("Sample") ? "this customer" : c.name.split(" ")[0]}</h2>
            <KitTextarea aria-label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Goes through the same consent checks; you take over the thread." />
            <Button size="sm" className="mt-2" leading={<MessageSquare size={14} aria-hidden />} disabled={!msg.trim() || busy === "send"}
              onClick={() => act("send", async () => { const m = await api.post<{ status: string; blocked_reason?: string }>(`/people/${id}/messages`, { body: msg, channel: c.prefs.channel, by: "Staff E" }); setMsg(""); setFlash(m.status === "sent_simulated" ? "Sent (simulated)" : `Not sent: ${m.blocked_reason}`); })}>
              Send {c.prefs.channel.toUpperCase()}</Button>
          </Card>

          <Card className="p-5">
            <h2 className="text-subheading font-semibold text-ink">Coming up</h2>
            {v.moments.length === 0 && <p className="mt-1 text-subtitle text-ink-muted">Nothing scheduled.</p>}
            <ul className="mt-2 space-y-2.5">
              {v.moments.map((m) => (
                <li key={m.id} className="text-subtitle">
                  <span className="tabular-nums text-ink-muted">{day(m.due)}</span> · {m.reason}
                  <div className="mt-1 flex items-center gap-2">
                    {m.human_only ? <Tag tone="gray" soft>for a person to bring up</Tag> : <Tag tone="brand" soft>message</Tag>}
                    <Button size="sm" variant="text" disabled={busy === m.id} onClick={() => act(m.id, () => api.post(`/moments/${m.id}/draft`), m.human_only ? "Added to the call list" : "Drafted: approve it in Outreach")}>
                      {m.human_only ? "Add to call list" : "Draft now"}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><ShieldCheck size={18} aria-hidden />Consent & preferences</h2>
            <dl className="mt-2 space-y-1.5 text-subtitle">
              <Row k="Marketing messages">{v.consent.ok ? <Tag tone="green" soft>allowed</Tag> : <Tag tone="gray" soft>not allowed</Tag>} <span className="text-caption text-ink-muted">{v.consent.why as string}</span></Row>
              <Row k="Evidence">{c.consent.sms.evidence_ref ?? "—"}</Row>
              <Row k="Channel">{c.prefs.channel.toUpperCase()} · quiet {c.prefs.quiet_start}:00-{c.prefs.quiet_end}:00</Row>
            </dl>
            <div className="mt-3 space-y-2">
              <Toggle label="Storm check-ins" on={c.prefs.storm_checkin_opt_in} onClick={() => act("storm", () => api.patch(`/people/${id}`, { storm_checkin_opt_in: !c.prefs.storm_checkin_opt_in }))} />
              <Toggle label="Personalised reminders (express)" on={c.consent.personalised_reminders} onClick={() => act("pers", () => api.patch(`/people/${id}`, { personalised_reminders: !c.consent.personalised_reminders }))} />
              <Toggle label="Do not contact" on={c.do_not_contact} onClick={() => act("dnc", () => api.patch(`/people/${id}`, { do_not_contact: !c.do_not_contact }))} />
            </div>
          </Card>

          {v.tasks.length > 0 && (
            <Card className="p-5">
              <h2 className="text-subheading font-semibold text-ink">Open tasks</h2>
              <ul className="mt-2 space-y-2">
                {v.tasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 text-subtitle">{t.title}
                    <Button size="sm" variant="text" onClick={() => act(t.id, () => api.post(`/tasks/${t.id}/done`))}>Done</Button></li>
                ))}
              </ul>
            </Card>
          )}

          {v.messages.length > 0 && (
            <Card className="p-5">
              <h2 className="text-subheading font-semibold text-ink">Messages</h2>
              <ul className="mt-2 space-y-3">
                {v.messages.slice(0, 8).map((m) => (
                  <li key={m.id} className={cx("rounded-ds-sm p-2.5 text-subtitle", m.direction === "in" ? "bg-kit-gray-faint" : "bg-brand-tint/50")}>
                    <p className="flex flex-wrap items-center gap-1.5 text-caption text-ink-muted">{m.direction === "in" ? "Customer" : "Mold Busters"} · {dayTime(m.created_at)} ·
                      <Tag tone={m.status === "blocked" ? "red" : m.status === "draft" ? "orange" : "gray"} soft>{m.status.replace("_simulated", " (sim.)")}</Tag></p>
                    <p className="mt-1 text-ink">{(m.final_body ?? m.body).replace(/\{booking_link\}/g, "[booking link]")}</p>
                    {m.blocked_reason && <p className="mt-1 text-caption text-kit-red">{m.blocked_reason}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {v.cases.length > 0 && (
            <Card className="p-5">
              <h2 className="text-subheading font-semibold text-ink">Jobs</h2>
              {v.cases.map((k) => (
                <Link key={k.id as string} href={`/cases/${k.id}/review`} className="mt-2 block text-subtitle text-brand hover:underline">{k.title as string} →</Link>
              ))}
            </Card>
          )}
        </div>
      </div>
    </StaffShell>
  );
}

function FactRow({ f, onChange }: { f: ProfileFact; onChange: () => void }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(f.text);
  const run = async (fn: () => Promise<unknown>) => { await fn(); onChange(); };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {edit ? (
            <div className="flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Fact" className="h-9 flex-1 rounded-ds-xsm border border-kit-gray-soft px-2 text-subtitle" />
              <Button size="sm" onClick={() => run(async () => { await api.patch(`/facts/${f.id}`, { text, by: "Staff E" }); setEdit(false); })}>Save</Button>
            </div>
          ) : (
            <p className="text-subtitle font-medium text-ink">{f.text}</p>
          )}
          <p className="mt-0.5 text-caption text-ink-muted">
            &ldquo;{f.source.quote}&rdquo; · said {HOW[f.source.kind] ?? f.source.kind} on {day(f.learned_at)}
            {f.edits.length > 0 && ` · edited by ${f.edits[f.edits.length - 1].by}`}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Tag tone={f.category === "health" ? "red" : "gray"} soft>{CAT[f.category]}</Tag>
            {f.category === "health" ? <Tag tone="gray" soft>never used in messages</Tag> : f.message_use === "light" ? <Tag tone="green" soft>OK to mention</Tag> : <Tag tone="gray" soft>talking point only</Tag>}
            {f.follow_up && <Tag tone="brand" soft>follow up {day(f.follow_up)}</Tag>}
            <ByTag by={f.extracted_by === "ai" ? "ai" : f.extracted_by === "rule" ? "rule" : f.extracted_by} />
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {f.status === "pending" && <Button size="sm" leading={<Check size={14} aria-hidden />} onClick={() => run(() => api.post(`/facts/${f.id}/approve`))}>Approve</Button>}
          <button aria-label="Edit fact" onClick={() => setEdit(!edit)} className="grid h-9 w-9 place-items-center rounded-ds-xsm text-ink-muted hover:bg-kit-gray-faint">{edit ? <X size={15} /> : <Pencil size={15} />}</button>
          <button aria-label="Delete fact" onClick={() => run(() => api.post(`/facts/${f.id}/reject`))} className="grid h-9 w-9 place-items-center rounded-ds-xsm text-ink-muted hover:bg-alert-danger-bg hover:text-kit-red"><Trash2 size={15} /></button>
        </div>
      </div>
    </li>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-x-2"><dt className="w-32 shrink-0 text-ink-muted">{k}</dt><dd className="flex flex-wrap items-center gap-1.5">{children}</dd></div>;
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} className="flex w-full items-center justify-between rounded-ds-xsm px-1 py-1 text-subtitle hover:bg-kit-gray-faint">
      {label}
      <span className={cx("relative h-6 w-11 rounded-full transition-colors", on ? "bg-brand" : "bg-kit-gray-soft")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}
