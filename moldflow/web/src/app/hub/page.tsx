"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, CalendarClock, CheckCheck, CloudRain, FlaskConical, Inbox, MessageSquarePlus, PiggyBank, Sparkles, Timer } from "lucide-react";
import { api, money } from "@/lib/api";
import { Button, Card, Eyebrow, KitTextarea, Spinner, StaffShell, Tag, buttonClass, cx } from "@/components/ui";
import { SYSTEMS, SourceChip, day, dayTime } from "@/components/hub";
import { Pillars } from "@/components/pillars";
import { MusePanel } from "@/components/muse-panel";

type Hub = {
  today: string; clock_travelling: boolean; paused: boolean;
  needs_you: { drafts: number; locked_drafts: number; pending_facts: number; escalations: number; callbacks: number; blocked: number; held: number;
    tasks: { id: string; kind: string; title: string; contact_id?: string; due?: string }[] };
  alerts: { id: string; type: string; area: string; source: string; matches: number; opted_in: number; drafted: number }[];
  today_jobs: { case_id: string; time?: string; name: string; concern: string; address?: string }[];
  inbound: { contact_id: string; name: string; body: string; at: string; owner: string; reply_draft_id?: string | null }[];
  money: { open_estimates_total: number; open_estimates: number; recovered_total: number; funnel: { chased: number; replied: number; accepted: number };
    at_risk: { contact_id: string; name: string; number: string; amount: number; status: string; days_since: number; expires: string; chased: boolean }[];
    recovered: { contact_id: string; amount: number; number: string; at: string }[] };
  autonomy: { auto_sent_7d: number; approved_sent_7d: number; edited_7d: number; blocked_total: number };
  moments: { id: string; contact_id: string; name: string; kind: string; due: string; reason: string; human_only: boolean }[];
  counts: { contacts: number; synthetic: number; tools_unified: string[] };
};

const KIND: Record<string, string> = { estimate_expiry: "Estimate expiring", post_remediation_check: "1-year check", back_to_school: "Back to school",
  nursery_humidity: "Nursery humidity", fact_follow_up: "Follow-up", storm_season: "Storm season", spring_melt: "Spring melt" };

export default function HubPage() {
  const [h, setH] = useState<Hub | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => api.get<Hub>("/hub").then(setH), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);
  if (!h) return <StaffShell><Spinner label="Loading the hub…" /></StaffShell>;
  const n = h.needs_you;
  const act = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); try { await fn(); await load(); } finally { setBusy(null); } };
  const chase = (cid: string) => act(`chase-${cid}`, () => api.post(`/people/${cid}/chase`));

  return (
    <StaffShell>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow color="text-brand">MoldFlow Hub · {day(h.today)}{h.clock_travelling && " (time travel on)"}</Eyebrow>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight text-ink">Approve or deny what&apos;s waiting</h1>
          <p className="mt-1 text-subtitle text-ink-body">Replies, check-ins and reports are drafted for you; routine ones already went out.</p>
        </div>
        <p className="text-caption text-ink-muted">{h.counts.contacts} people · {h.counts.synthetic} synthetic demo customers · one timeline across {h.counts.tools_unified.length} tools</p>
      </div>

      {h.alerts.map((a) => (
        <Card key={a.id} tone="warning" className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <CloudRain className="text-kit-orange" aria-hidden />
          <p className="flex-1 text-subtitle text-ink"><b className="capitalize">{a.type}</b> · {a.area}{a.source === "simulated" && " (simulated)"}: {a.matches} customers in the area, {a.opted_in} asked for storm check-ins
            {a.drafted ? ` · ${a.drafted} check-ins drafted` : ""}.</p>
          <Link href="/alerts"><Button size="sm" trailing={<ArrowRight size={14} aria-hidden />}>{a.drafted ? "Review batch" : "Draft check-ins"}</Button></Link>
        </Card>
      ))}
      <Pillars />

      <section aria-labelledby="needs" className="mb-6">
        <h2 id="needs" className="sr-only">Needs you</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <NeedTile href="/outreach" n={n.drafts} label="messages to approve" sub={n.locked_drafts ? `${n.locked_drafts} with money: always yours` : "AI drafted, you approve"} tone="brand" />
          <NeedTile href="/people?pending=1" n={n.pending_facts} label="new facts to check" sub="learned from calls & texts" />
          <NeedTile href="/outreach?tab=tasks" n={n.escalations + n.callbacks} label="people to call" sub={`${n.escalations} escalations · ${n.callbacks} asked for a person`} tone={n.escalations ? "red" : undefined} />
          <NeedTile href="/outreach?tab=blocked" n={n.blocked + n.held} label="held or blocked" sub="consent, quiet hours, kill switch" />
          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-caption font-medium text-ink-muted"><Bot size={14} aria-hidden />AI this week</p>
            <p className="mt-1 text-h6 font-semibold tabular-nums text-ink">{h.autonomy.auto_sent_7d + h.autonomy.approved_sent_7d} sent</p>
            <p className="text-caption text-ink-muted">{h.autonomy.auto_sent_7d} on its own · {h.autonomy.approved_sent_7d} approved · {h.autonomy.edited_7d} edited · {h.autonomy.blocked_total} blocked by rules</p>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><PiggyBank size={18} aria-hidden />Money on the table</h2>
              <p className="text-caption text-ink-muted">{h.money.open_estimates} open estimates</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Open estimates" value={money(h.money.open_estimates_total)} />
              <Stat label="Chased → replied → accepted" value={`${h.money.funnel.chased} → ${h.money.funnel.replied} → ${h.money.funnel.accepted}`} />
              <Stat label="Recovered by MoldFlow" value={money(h.money.recovered_total)} accent />
            </div>
            <ul className="mt-4 divide-y divide-kit-gray-soft">
              {h.money.at_risk.map((e) => (
                <li key={e.number} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Link href={`/people/${e.contact_id}`} className="min-w-40 flex-1 text-subtitle font-medium text-ink hover:text-brand">{e.name}</Link>
                  <span className="tabular-nums text-subtitle text-ink">{money(e.amount)}</span>
                  <Tag tone="orange" soft>viewed {e.days_since}d ago, not accepted</Tag>
                  <span className="text-caption text-ink-muted">valid to {day(e.expires)}</span>
                  {e.chased ? <Tag tone="green" soft>chased</Tag> :
                    <Button size="sm" variant="outline" disabled={busy === `chase-${e.contact_id}`} onClick={() => chase(e.contact_id)}>Draft follow-up</Button>}
                </li>
              ))}
            </ul>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><CalendarClock size={18} aria-hidden />Today</h2>
              {h.today_jobs.length === 0 && <p className="mt-2 text-subtitle text-ink-muted">No inspections booked today.</p>}
              <ul className="mt-2 space-y-2">
                {h.today_jobs.map((j) => (
                  <li key={j.case_id} className="text-subtitle"><b>{j.time}</b> · {j.name} · <span className="text-ink-muted">{j.concern}</span></li>
                ))}
              </ul>
              <h3 className="mt-4 text-caption font-medium uppercase tracking-wide text-ink-muted">To do</h3>
              <ul className="mt-1 space-y-1.5">
                {n.tasks.length === 0 && <li className="text-caption text-ink-muted">Nothing open.</li>}
                {n.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-subtitle">
                    <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", t.kind === "escalation" ? "bg-kit-red" : "bg-brand")} />
                    {t.contact_id ? <Link className="hover:text-brand" href={`/people/${t.contact_id}`}>{t.title}</Link> : t.title}
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><Inbox size={18} aria-hidden />Inbound</h2>
              {h.inbound.length === 0 && <p className="mt-2 text-subtitle text-ink-muted">No new replies.</p>}
              <ul className="mt-2 space-y-3">
                {h.inbound.map((m, i) => (
                  <li key={i} className="text-subtitle">
                    <Link href={`/people/${m.contact_id}`} className="font-medium text-ink hover:text-brand">{m.name}</Link>
                    <span className="ml-2 text-caption text-ink-muted">{dayTime(m.at)}</span>
                    <p className="text-ink-body">&ldquo;{m.body}&rdquo;</p>
                    {m.reply_draft_id ? <Link href="/outreach" className="text-caption font-medium text-brand">Reply drafted: review →</Link>
                      : <span className="text-caption text-ink-muted">{m.owner.startsWith("human") ? "A person is handling this" : "Answered"}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><Timer size={18} aria-hidden />Coming up</h2>
            <ul className="mt-2 space-y-2.5">
              {h.moments.map((m) => (
                <li key={m.id} className="text-subtitle">
                  <span className="tabular-nums text-ink-muted">{day(m.due)}</span> · <Link href={`/people/${m.contact_id}`} className="font-medium text-ink hover:text-brand">{m.name}</Link>
                  <span className="ml-1.5"><Tag tone={m.human_only ? "gray" : "brand"} soft>{KIND[m.kind] ?? m.kind}{m.human_only ? " · call" : ""}</Tag></span>
                  <p className="text-caption text-ink-muted">{m.reason}</p>
                </li>
              ))}
            </ul>
          </Card>
          <DemoPanel onDone={load} />
          <Card className="p-5">
            <h2 className="text-subheading font-semibold text-ink">One place instead of seven</h2>
            <p className="mt-1 text-caption text-ink-muted">Every person&apos;s history from these tools sits on one timeline. FreshBooks and Google Calendar stay as the system of record; Close sequences, Asana cards and Brain notes are replaced.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{Object.keys(SYSTEMS).filter((s) => s !== "bruce").map((s) => <SourceChip key={s} system={s} />)}</div>
            <Link href="/compare" className="mt-3 inline-block text-caption font-medium text-brand">See Job 1 before / after →</Link>
          </Card>
        </div>
      </div>
      </div>
      <MusePanel />
      </div>
    </StaffShell>
  );
}

function NeedTile({ href, n, label, sub, tone }: { href: string; n: number; label: string; sub: string; tone?: "brand" | "red" }) {
  return (
    <Link href={href} className="group">
      <Card className={cx("h-full p-4 transition-shadow group-hover:shadow-ds-normal", n === 0 && "opacity-70")}>
        <p className={cx("text-[24px] font-semibold tabular-nums", n === 0 ? "text-ink-muted" : tone === "red" ? "text-kit-red" : tone === "brand" ? "text-brand" : "text-ink")}>{n}</p>
        <p className="text-subtitle font-medium text-ink">{label}</p>
        <p className="text-caption text-ink-muted">{sub}</p>
      </Card>
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cx("rounded-ds-sm p-3", accent ? "bg-alert-success-bg" : "bg-kit-gray-faint")}>
      <p className={cx("text-h6 font-semibold tabular-nums", accent ? "text-kit-green" : "text-ink")}>{value}</p>
      <p className="text-caption text-ink-muted">{label}</p>
    </div>
  );
}

function DemoPanel({ onDone }: { onDone: () => void }) {
  const [from, setFrom] = useState("(613) 555-7788");
  const [body, setBody] = useState("Hi, I found black stuff on my basement wall. Is it dangerous? My son has asthma.");
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<string>) => { setBusy(true); try { setOut(await fn()); onDone(); } catch (e) { setOut(String(e)); } finally { setBusy(false); } };
  return (
    <Card className="border-dashed p-5">
      <h2 className="flex items-center gap-2 text-subheading font-semibold text-ink"><FlaskConical size={18} aria-hidden />Demo controls</h2>
      <p className="mt-1 text-caption text-ink-muted">Simulate what Twilio, email and Environment Canada would send in.</p>
      <label className="mt-3 block text-caption font-medium text-ink-muted" htmlFor="sim-from">Inbound text from</label>
      <input id="sim-from" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-10 w-full rounded-ds-xsm border border-kit-gray-soft px-3 text-subtitle" />
      <KitTextarea aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="mt-2" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" leading={<MessageSquarePlus size={14} aria-hidden />} disabled={busy}
          onClick={() => run(async () => {
            const r = await api.post<{ intent: string; reply: { status: string; body: string; final_body?: string | null }; contact_id: string }>("/webhooks/inbound", { from_: from, channel: "sms", body });
            return `${r.intent}: reply ${r.reply.status === "sent_simulated" ? "sent instantly" : r.reply.status === "approved" ? "approved instantly, sends after quiet hours" : "drafted for approval"} → "${(r.reply.final_body || r.reply.body.replace("{booking_link}", "(booking link)")).slice(0, 90)}…"`;
          })}>Send text</Button>
        <Button size="sm" variant="outline" leading={<CloudRain size={14} aria-hidden />} disabled={busy}
          onClick={() => run(async () => { const r = await api.post<{ matched: unknown[] }>("/alerts/simulate", { zone: "City of Ottawa" }); return `Rainfall warning simulated over Ottawa: ${r.matched.length} customers in the area.`; })}>
          Simulate storm: Ottawa</Button>
        <Link href="/assess/demo-tenant" className={buttonClass({ size: "sm", variant: "outline" })}>Tenant pack demo ($50)</Link>
      </div>
      {out && <p role="status" className="mt-3 flex gap-1.5 rounded-ds-xsm bg-kit-gray-faint p-2 text-caption text-ink-body"><Sparkles size={13} className="mt-0.5 shrink-0" aria-hidden />{out}</p>}
      <p className="mt-3 flex items-center gap-1.5 text-caption text-ink-muted"><AlertTriangle size={12} aria-hidden />Nothing is actually sent: SMS/email are simulated until Twilio/Resend keys are added. <CheckCheck size={12} aria-hidden /></p>
    </Card>
  );
}
