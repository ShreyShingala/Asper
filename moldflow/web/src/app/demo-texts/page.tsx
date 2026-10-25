"use client";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, FastForward, Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Eyebrow, Spinner, StaffShell, Tag, cx } from "@/components/ui";
import { PersonPanel, type Person } from "@/components/people";

type Queue = { today: string; queue: { id: string; name: string; due: string; reason: string; status: string; overdue: boolean }[] };
type Result = { reply?: { status: string; body: string } | null; facts?: { text: string; status: string }[]; followup?: { due: string; reason: string } | null;
  keyword?: string | null; person: Person };

const IDEAS = ["We just found out we're expecting a baby in May!", "Can you text me back next week? I'm travelling.",
  "Is it safe to sleep in that room tonight?", "Can I just clean it with bleach?", "What time is the technician coming?"];

/** Demo sandbox: pretend to be a customer. Texts go through the real pipeline: auto reply, facts learned, follow-ups scheduled. */
export default function DemoTexts() {
  const [people, setPeople] = useState<Person[]>([]);
  const [who, setWho] = useState<string>("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Result | null>(null);
  const [q, setQ] = useState<Queue | null>(null);
  const [fired, setFired] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [o, f] = await Promise.all([api.get<{ people: Person[] }>("/people/overview"), api.get<Queue>("/followups")]);
    setPeople(o.people); setQ(f);
    setWho((w) => w || o.people[0]?.id || "");
  }, []);
  useEffect(() => { void load(); }, [load]);
  const person = (last && last.person.id === who ? last.person : null) ?? people.find((p) => p.id === who);

  async function send(e?: React.FormEvent, body = text) {
    e?.preventDefault();
    if (!body.trim() || !who) return;
    setBusy(true); setFired(null);
    try { setLast(await api.post<Result>("/demo/text", { contact_id: who, body })); setText(""); await load(); } finally { setBusy(false); }
  }
  async function advance(days: number) {
    setBusy(true);
    try {
      const r = await api.post<{ today: string; fired: { name: string; status: string }[] }>("/demo/advance", { days });
      setFired(`Now ${r.today}: ${r.fired.length ? r.fired.map((x) => `${x.name} (${x.status.replace("_simulated", "")})`).join(", ") : "no follow-ups due"}`);
      setLast(null); await load();
    } finally { setBusy(false); }
  }

  return (
    <StaffShell title="Demo: text as a customer">
      <p className="-mt-3 mb-5 text-subtitle font-light text-ink-body">Pick a customer and text the agent as them. The reply, anything it learns and any follow-up it schedules show up instantly, alongside the real follow-up queue.</p>
      {!q ? <Spinner label="Loading…" /> : (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)_340px]">
          <Card className="flex flex-col gap-3 p-5">
            <Eyebrow>You are</Eyebrow>
            <select value={who} onChange={(e) => { setWho(e.target.value); setLast(null); }} className="h-11 rounded-ds-xsm border border-kit-gray-soft px-3 text-subtitle">
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="rounded-[28px] border-8 border-kit-navy bg-kit-gray-faint p-3">
              <ol className="flex h-80 flex-col gap-1.5 overflow-y-auto">
                {(person?.messages ?? []).map((m) => (
                  <li key={m.id} className={cx("w-fit max-w-[85%] rounded-2xl px-3 py-1.5 text-caption", m.dir === "in" ? "ml-auto bg-brand text-white" : "bg-white text-ink",
                    m.status === "draft" && "border border-dashed border-brand bg-white/60 text-ink-muted")}>{m.status === "draft" ? "(AI draft, waiting for approval) " : ""}{m.text}</li>
                ))}
              </ol>
              <form onSubmit={send} className="mt-2 flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Text Mold Busters…" aria-label="Your text"
                  className="h-11 min-w-0 flex-1 rounded-full border border-kit-gray-soft px-4 text-[16px]" />
                <Button type="submit" state={busy ? "loading" : undefined} aria-label="Send"><Send size={16} aria-hidden /></Button>
              </form>
            </div>
            <div className="flex flex-wrap gap-1.5">{IDEAS.map((i) => <button key={i} onClick={() => void send(undefined, i)} className="rounded-full border border-kit-gray-soft px-2.5 py-1 text-[11px] text-ink-body hover:border-brand">{i}</button>)}</div>
          </Card>

          <div className="space-y-4">
            {last && (
              <Card tone="info" className="space-y-2 p-4 text-subtitle">
                <p className="flex items-center gap-1.5 font-semibold text-ink"><Sparkles size={15} aria-hidden />What the agent just did</p>
                {last.reply && <p>Reply <Tag tone={last.reply.status === "sent_simulated" ? "green" : "brand"} soft>{last.reply.status === "sent_simulated" ? "sent automatically" : last.reply.status === "draft" ? "drafted for approval" : last.reply.status}</Tag>: {last.reply.body}</p>}
                {last.keyword && <p>Keyword: {last.keyword.toUpperCase()}</p>}
                {(last.facts ?? []).length > 0 && <p>Learned: {last.facts!.map((f) => `${f.text} (${f.status})`).join("; ")}</p>}
                {last.followup && <p>Follow-up scheduled for <b>{last.followup.due}</b>: {last.followup.reason}</p>}
                {!last.facts?.length && !last.followup && <p className="text-caption text-ink-muted">Nothing new to remember from that text.</p>}
              </Card>
            )}
            {person && <PersonPanel p={person} />}
          </div>

          <Card className="h-fit space-y-3 p-5">
            <p className="flex items-center gap-1.5 text-subheading font-semibold text-ink"><CalendarClock size={16} aria-hidden />Follow-up queue</p>
            <p className="text-caption text-ink-muted">Demo date: {q.today}. When a follow-up comes due it sends itself.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" leading={<FastForward size={14} aria-hidden />} onClick={() => void advance(1)}>+1 day</Button>
              <Button size="sm" variant="outline" leading={<FastForward size={14} aria-hidden />} onClick={() => void advance(7)}>+7 days</Button>
            </div>
            {fired && <p role="status" className="rounded-ds-xsm bg-alert-success-bg p-2 text-caption text-alert-success-title">{fired}</p>}
            <ol className="space-y-2">
              {q.queue.map((f) => (
                <li key={f.id} className={cx("rounded-ds-xsm border p-2.5 text-caption", f.status !== "upcoming" ? "border-kit-gray-soft text-ink-muted" : f.overdue ? "border-brand" : "border-kit-gray-soft")}>
                  <p className="font-medium text-ink">{f.due} · {f.name} <Tag tone={f.status === "upcoming" ? "gray" : "green"} soft>{f.status === "done" ? "sent" : f.status}</Tag></p>
                  <p className="mt-0.5 text-ink-body">{f.reason}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}
    </StaffShell>
  );
}
