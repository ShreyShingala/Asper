"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Clock, FastForward, Mail, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Eyebrow, Logo, Spinner, Tag, TextArea, buttonClass, cx } from "@/components/ui";

type Msg = { id: string; kind: string; to_name: string; to_address: string; from_address: string; on_behalf_of?: string | null; cc: string[];
  subject: string; body: string; status: string; step?: number | null; sent_at?: string | null; channel: string };
type Rung = { n: number; title: string; to_role: string; state: "sent" | "awaiting_you" | "skipped" | "next" | "later"; message_id?: string | null; due?: string | null };
type PackOut = { pack: { status: string; landlord_name: string; tenant_email: string; next_due?: string | null } | null; ladder: Rung[]; today: string; outbox: Msg[] };

const STATE = { sent: ["Sent", "green"], awaiting_you: ["Needs your OK", "brand"], skipped: ["Skipped", "gray"], next: ["Waiting on landlord", "orange"], later: ["If needed", "gray"] } as const;

export default function Pack() {
  const { caseId } = useParams<{ caseId: string }>();
  const [d, setD] = useState<PackOut | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => api.get<PackOut>(`/cases/${caseId}/pack`).then(setD), [caseId]);
  useEffect(() => { void load(); }, [load]);

  async function act(path: string, body: object, key: string) {
    setBusy(key);
    try { await api.post(path, body); setEdit(null); await load(); } finally { setBusy(null); }
  }

  if (!d) return <div className="grid min-h-dvh place-items-center"><Spinner label="Loading…" /></div>;
  if (!d.pack) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
        <Card className="space-y-3 p-6 text-center">
          <p className="text-body text-ink">No tenant action pack on this case yet.</p>
          <Link href={`/assess/${caseId}/checkout?product=tenant_pack`} className={buttonClass({ size: "lg", fullWidth: true })}>Get the tenant action pack · $50</Link>
        </Card>
      </main>
    );
  }
  const pending = d.outbox.find((m) => m.status === "awaiting_approval");

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 pb-12 pt-5">
      <div className="flex items-center justify-between">
        <Logo small />
        <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "text", size: "sm" })}><ArrowLeft size={14} aria-hidden />My pre-assessment</Link>
      </div>
      <section className="rise mt-6">
        <Eyebrow color="text-brand">Tenant action pack · {d.pack.status === "resolved" ? "resolved" : d.pack.status}</Eyebrow>
        <h1 className="mt-1 text-h5 font-bold tracking-tight text-ink">Getting {d.pack.landlord_name} to act</h1>
        <p className="mt-2 text-subtitle font-light text-ink-body">We send each step from a Mold Busters address on your behalf, with you copied. Nothing goes out until you approve it.</p>
      </section>

      {d.pack.status === "resolved" && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-ds-sm bg-alert-success-bg p-3 text-subtitle font-medium text-alert-success-title">
          <Check size={16} aria-hidden />Your landlord replied. We stopped the escalation.</p>
      )}

      {pending && (
        <Card className="rise mt-5 overflow-hidden border-l-4 border-l-brand">
          <div className="space-y-1 border-b border-kit-gray-soft px-5 py-4 text-caption text-ink-body">
            <p className="text-subtitle font-semibold text-ink">{pending.subject}</p>
            <p><span className="text-ink-muted">To:</span> {pending.to_name} &lt;{pending.to_address}&gt;</p>
            <p><span className="text-ink-muted">From:</span> {pending.from_address} on behalf of {pending.on_behalf_of}</p>
            <p><span className="text-ink-muted">CC:</span> {pending.cc.join(", ")}</p>
          </div>
          {edit === pending.id ? (
            <div className="p-4"><TextArea aria-label="Edit message" rows={12} value={draft} onChange={(e) => setDraft(e.target.value)} /></div>
          ) : (
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap p-5 font-sans text-subtitle text-ink">{pending.body}</pre>
          )}
          <div className="grid gap-2 border-t border-kit-gray-soft p-4">
            {pending.channel !== "form" && <MailButtons m={pending} />}
            <Button size="lg" leading={<Send size={18} aria-hidden />} state={busy === "send" ? "loading" : undefined}
              onClick={() => void act(`/cases/${caseId}/outbox/${pending.id}/approve`, { by: "tenant", body: edit === pending.id ? draft : undefined }, "send")}>
              {pending.channel === "form" ? "Approve and file on my behalf" : "Send on my behalf"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { setEdit(pending.id); setDraft(pending.body); }}>Edit</Button>
              <Button variant="text" leading={<X size={14} aria-hidden />} onClick={() => void act(`/cases/${caseId}/outbox/${pending.id}/deny`, { by: "tenant", reason: "Tenant chose not to send" }, "deny")}>Not now</Button>
            </div>
          </div>
        </Card>
      )}

      {!pending && (() => {
        const latest = [...d.outbox].reverse().find((m) => m.status === "sent_simulated" && m.channel !== "form");
        return latest ? (
          <Card className="mt-5 space-y-3 p-5">
            <p className="text-subtitle font-semibold text-ink">Sent for you: {latest.subject}</p>
            <p className="text-caption text-ink-muted">To {latest.to_name} &lt;{latest.to_address}&gt; · CC {latest.cc.join(", ")}. Open it in your mail to send it from your own account too:</p>
            <MailButtons m={latest} />
          </Card>
        ) : null;
      })()}

      <Card className="mt-5 p-5">
        <h2 className="text-subheading font-semibold text-ink">Your escalation steps</h2>
        <ol className="mt-3 space-y-3">
          {d.ladder.map((r) => {
            const [label, tone] = STATE[r.state];
            const sent = d.outbox.find((m) => m.id === r.message_id && m.status === "sent_simulated");
            return (
              <li key={r.n} className="flex gap-3">
                <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-caption font-semibold",
                  r.state === "sent" ? "bg-kit-green text-white" : r.state === "awaiting_you" ? "bg-brand text-white" : "bg-kit-gray-faint text-ink-muted")}>
                  {r.state === "sent" ? <Check size={14} aria-hidden /> : r.n}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-subtitle font-medium text-ink">{r.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Tag tone={tone} soft>{label}</Tag>
                    {r.due && <span className="flex items-center gap-1 text-caption text-ink-muted"><Clock size={12} aria-hidden />reply due {r.due}</span>}
                    {sent?.sent_at && <span className="flex items-center gap-1 text-caption text-ink-muted"><Mail size={12} aria-hidden />sent {new Date(sent.sent_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      {d.pack.status === "active" && !pending && (
        <div className="mt-5 grid gap-2 rounded-ds-sm border border-dashed border-kit-gray p-4">
          <Eyebrow>Demo controls · today is {d.today}</Eyebrow>
          <Button variant="outline" leading={<FastForward size={16} aria-hidden />} state={busy === "skip" ? "loading" : undefined}
            onClick={() => void act("/demo/skip", { days: 7 }, "skip")}>Skip 7 days (landlord doesn&apos;t reply)</Button>
          <Button variant="text" onClick={() => void act(`/cases/${caseId}/pack/state`, { action: "landlord_replied" }, "reply")}>Landlord replies</Button>
        </div>
      )}
      <p className="mt-6 text-caption font-light text-ink-muted">Document preparation, not legal advice. Free tenant legal clinics can help you file with the tribunal.</p>
    </main>
  );
}

/** Prefilled compose windows: the letter opens in Gmail or Outlook (signed in as moldbusters@gmail.com); you press Send. */
function compose(m: Msg) {
  const q = (o: Record<string, string>) => Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const cc = m.cc.join(",");
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&${q({ to: m.to_address, cc, su: m.subject, body: m.body })}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?${q({ to: m.to_address, cc, subject: m.subject, body: m.body })}`,
  };
}

function MailButtons({ m }: { m: Msg }) {
  const l = compose(m);
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={l.gmail} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}><Mail size={16} aria-hidden />Open in Gmail</a>
      <a href={l.outlook} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}><Mail size={16} aria-hidden />Open in Outlook</a>
    </div>
  );
}
