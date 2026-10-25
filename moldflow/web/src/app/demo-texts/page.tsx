"use client";
import { useCallback, useEffect, useState } from "react";
import { Bot, CalendarClock, Check, FastForward, Heart, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Eyebrow, Spinner, StaffShell, Tag, cx } from "@/components/ui";
import type { Person } from "@/components/people";

type Queue = { today: string; queue: { id: string; name: string; due: string; reason: string; status: string; overdue: boolean }[] };
type Reply = { id: string; status: string; body: string; final_body?: string | null; blocked_reason?: string | null; autonomy?: string };
type Result = { reply?: Reply | null; facts?: { text: string; status: string }[]; followup?: { due: string; reason: string } | null; keyword?: string | null; person: Person };

const IDEAS = ["We just found out we're expecting a baby in May!", "Can you text me back next week? I'm travelling.",
  "Is it safe to sleep in that room tonight?", "Can I just clean it with bleach?", "What time is the technician coming?"];

/** Demo sandbox, side by side: you text as the customer (left); the Mold Busters agent answers on its own or drafts for
 *  your approval, remembers what you said and schedules follow-ups (right). */
export default function DemoTexts() {
  const [people, setPeople] = useState<Person[]>([]);
  const [who, setWho] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<Result | null>(null);
  const [q, setQ] = useState<Queue | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, f] = await Promise.all([api.get<{ people: Person[] }>("/people/overview"), api.get<Queue>("/followups")]);
      setPeople(o.people); setQ(f);
      setWho((w) => w || o.people[0]?.id || "");
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => {  // live: the phone and the agent panel refresh every 2.5 s
    const t = setTimeout(() => void load(), 0);
    const iv = setInterval(() => void load(), 2500);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [load]);
  const person = people.find((p) => p.id === who);
  const drafts = (person?.messages ?? []).filter((m) => m.status === "draft");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setErr(null); setNote(null);
    try { await fn(); await load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const send = (body = text) => body.trim() && who && run("send", async () => {
    setLast(await api.post<Result>("/demo/text", { contact_id: who, body })); setText("");
  });
  const approve = (id: string) => run(id, async () => { await api.post(`/messages/${id}/approve`, { by: "Owner" }); setNote("Approved and sent to the customer (simulated)."); });
  const deny = (id: string) => run(`x${id}`, async () => { await api.post(`/messages/${id}/deny-draft`); setNote("Draft denied."); });
  const proactive = () => run("pro", async () => {
    const r = await api.post<{ fact: string }>("/proactive/draft", { contact_id: who }); setNote(`Proactive check-in drafted from: ${r.fact}`);
  });
  const advance = (days: number) => run(`a${days}`, async () => {
    const r = await api.post<{ today: string; fired: { name: string; status: string }[] }>("/demo/advance", { days });
    setNote(`Now ${r.today}: ${r.fired.length ? r.fired.map((x) => `${x.name} (${x.status.replace("_simulated", "")})`).join(", ") : "no follow-ups due"}`);
  });

  return (
    <StaffShell title="Demo: text as a customer">
      {!q ? <Spinner label="Loading…" /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-subtitle text-ink">You are{" "}
              <select value={who} onChange={(e) => { setWho(e.target.value); setLast(null); }} className="ml-1 h-11 rounded-ds-xsm border border-kit-gray-soft px-3 text-subtitle">
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <span className="text-caption text-ink-muted">Demo date {q.today}</span>
            <Button size="sm" variant="outline" leading={<FastForward size={14} aria-hidden />} state={busy === "a1" ? "loading" : undefined} onClick={() => void advance(1)}>+1 day</Button>
            <Button size="sm" variant="outline" leading={<FastForward size={14} aria-hidden />} state={busy === "a7" ? "loading" : undefined} onClick={() => void advance(7)}>+7 days</Button>
          </div>
          {err && <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-subtitle text-kit-red">{err}</p>}
          {note && <p role="status" className="rounded-ds-sm bg-alert-success-bg p-3 text-subtitle text-alert-success-title">{note}</p>}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <Eyebrow className="mb-3">Customer&apos;s phone</Eyebrow>
              <div className="mx-auto max-w-sm rounded-[28px] border-8 border-kit-navy bg-kit-gray-faint p-3">
                <ol className="flex h-[26rem] flex-col gap-1.5 overflow-y-auto">
                  {(person?.messages ?? []).filter((m) => m.status !== "draft").map((m) => (
                    <li key={m.id} className={cx("w-fit max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px]", m.dir === "in" ? "ml-auto bg-brand text-white" : "bg-white text-ink")}>{m.text}</li>
                  ))}
                </ol>
                <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-2 flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Text Mold Busters…" aria-label="Your text"
                    className="h-11 min-w-0 flex-1 rounded-full border border-kit-gray-soft px-4 text-[16px]" />
                  <Button type="submit" state={busy === "send" ? "loading" : undefined} aria-label="Send"><Send size={16} aria-hidden /></Button>
                </form>
              </div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">{IDEAS.map((i) => (
                <button key={i} onClick={() => void send(i)} className="rounded-full border border-kit-gray-soft px-2.5 py-1 text-[11px] text-ink-body hover:border-brand">{i}</button>
              ))}</div>
            </Card>

            <Card className="space-y-4 p-5">
              <Eyebrow className="flex items-center gap-1.5"><Bot size={13} aria-hidden />Mold Busters agent</Eyebrow>
              {last ? (
                <div className="space-y-2 rounded-ds-sm bg-brand-tint/60 p-3 text-subtitle">
                  <p className="flex items-center gap-1.5 font-semibold text-ink"><Sparkles size={15} aria-hidden />What it just did</p>
                  {last.keyword && <p>Keyword detected: {last.keyword.toUpperCase()}</p>}
                  {last.reply && <p><Tag tone={last.reply.status === "sent_simulated" ? "green" : "brand"} soft>{last.reply.status === "sent_simulated" ? "replied automatically" : last.reply.status === "draft" ? "drafted, needs your OK" : last.reply.status}</Tag>{" "}{last.reply.body}</p>}
                  {(last.facts ?? []).length > 0 && <p><b>Remembered:</b> {last.facts!.map((f) => f.text).join("; ")}</p>}
                  {last.followup && <p><b>Follow-up scheduled</b> for {last.followup.due}</p>}
                </div>
              ) : <p className="text-caption text-ink-muted">Send a text on the left: the agent&apos;s reply, what it learned and any follow-up show here.</p>}

              <div>
                <p className="mb-2 text-subtitle font-semibold text-ink">Waiting for your approval ({drafts.length})</p>
                {drafts.length === 0 && <p className="text-caption text-ink-muted">Nothing waiting. Routine answers go out on their own; anything personal or with money waits here.</p>}
                <ul className="space-y-2">{drafts.map((m) => (
                  <li key={m.id} className="rounded-ds-sm border border-brand/40 p-3">
                    <p className="text-subtitle text-ink">{m.text}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" leading={<Check size={14} aria-hidden />} state={busy === m.id ? "loading" : undefined} onClick={() => void approve(m.id)}>Approve &amp; send</Button>
                      <Button size="sm" variant="text" leading={<X size={14} aria-hidden />} onClick={() => void deny(m.id)}>Deny</Button>
                    </div>
                  </li>
                ))}</ul>
              </div>

              <div className="rounded-ds-sm border border-kit-gray-soft p-3">
                <p className="flex items-center gap-1.5 text-subtitle font-semibold text-ink"><Heart size={14} aria-hidden />Be proactive</p>
                <p className="mt-1 text-caption text-ink-muted">Drafts a personal check-in from what this customer told us (e.g. a new baby → free home check).</p>
                <Button size="sm" variant="outline" className="mt-2" state={busy === "pro" ? "loading" : undefined} onClick={() => void proactive()}>Draft a personal check-in</Button>
                {(person?.facts ?? []).length > 0 && <p className="mt-2 text-caption text-ink-body">Remembers: {person!.facts.slice(0, 3).map((f) => f.text).join(" · ")}</p>}
              </div>

              <div>
                <p className="mb-1 flex items-center gap-1.5 text-subtitle font-semibold text-ink"><CalendarClock size={14} aria-hidden />Follow-up queue</p>
                <ol className="max-h-56 space-y-1.5 overflow-y-auto">{q.queue.map((f) => (
                  <li key={f.id} className={cx("rounded-ds-xsm border px-2.5 py-1.5 text-caption", f.overdue ? "border-brand" : "border-kit-gray-soft", f.status !== "upcoming" && "text-ink-muted")}>
                    <b>{f.due}</b> · {f.name} <Tag tone={f.status === "upcoming" ? "gray" : "green"} soft>{f.status === "done" ? "sent" : f.status}</Tag><br />{f.reason}
                  </li>
                ))}</ol>
              </div>
            </Card>
          </div>
        </div>
      )}
    </StaffShell>
  );
}
