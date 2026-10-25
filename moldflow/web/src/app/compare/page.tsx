"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageSquareX, MessageSquareText, Clock, ShieldAlert } from "lucide-react";
import { api, type S } from "@/lib/api";
import { Button, Card, Eyebrow, Spinner, StaffShell, Tag, cx } from "@/components/ui";

type Ev = S["Event"];
type Cmp = {
  before: Ev[]; moldflow_events: Ev[]; followups: S["FollowUp"][];
  counters: { report_elapsed_before: string; report_window_before: string; report_ai_draft_seconds: number | null; report_approved: boolean;
    generic_touches_before: number; concern_answered_before: number; concern_specific_followups_after: number; issues_caught_before_sending: string[]; expiry: string | null };
};

export default function Compare() {
  const [d, setD] = useState<Cmp | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setD(await api.get<Cmp>("/compare/job1")), []);
  useEffect(() => { api.get<Cmp>("/compare/job1").then(setD); }, []);
  if (!d) return <StaffShell><Spinner label="Loading…" /></StaffShell>;
  const k = d.counters;
  const isGeneric = (e: Ev) => e.step.startsWith("Follow-up") || e.step === "Sales follow-up starts" || e.step === "Manual follow-up";

  return (
    <StaffShell>
      <Eyebrow>Sample job 1 · same customer, two workflows</Eyebrow>
      <h1 className="mt-1 text-[24px] font-semibold text-ink">Before / After</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Counter icon={Clock} label="Inspection → report" before="45h 35m elapsed" after={k.report_ai_draft_seconds ? `${k.report_ai_draft_seconds}s AI draft + review` : "Draft on demand + review"} note={k.report_window_before} />
        <Counter icon={MessageSquareX} label="Follow-ups that answered 'where is it coming from?'" before={`${k.concern_answered_before} of ${k.generic_touches_before}`} after={`${k.concern_specific_followups_after} drafted, all cite findings`} />
        <Counter icon={ShieldAlert} label="Issues caught before the proposal went out" before="0 flagged" after={`${k.issues_caught_before_sending.length} flagged`} note={k.expiry ? `Estimate valid until ${k.expiry}; MoldFlow shows it in every follow-up` : undefined} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="red" soft>What happened</Tag>
            <span className="text-caption font-light text-ink-muted">source: sample pack job_timeline.json</span>
          </div>
          <ol className="mt-4 space-y-3 border-l-2 border-kit-gray-soft pl-4">
            {d.before.map((e, i) => (
              <li key={i} className={cx("relative text-subtitle text-ink", isGeneric(e) && "rounded-ds-xsm bg-alert-danger-bg p-2")}>
                <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-kit-gray" />
                <span className="text-caption text-ink-muted">{e.at_text} · {e.system}</span>
                <p><b className="font-semibold">{e.step}.</b> {e.what}</p>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="border-t-4 border-t-brand p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone="brand" soft>With MoldFlow</Tag>
            <span className="text-caption font-light text-ink-muted">simulated workflow on the same seeded evidence</span>
          </div>
          <div className="mt-4 space-y-5">
            <Block title="Issues caught before sending">
              {k.issues_caught_before_sending.map((m, i) => <li key={i} className="text-subtitle text-ink">• {m}</li>)}
            </Block>
            <Block title="Follow-up that answers the actual question">
              {d.followups.length === 0 && (
                <li className="list-none">
                  <Button state={busy ? "loading" : undefined} leading={<MessageSquareText size={16} aria-hidden />}
                    onClick={async () => { setBusy(true); try { await api.post("/cases/job1/followups/draft", { as_of: "2026-10-09" }); } finally { setBusy(false); load(); } }}>
                    Draft the Oct 9 follow-up
                  </Button>
                </li>
              )}
              {d.followups.map((f) => (
                <li key={f.id} className="list-none">
                  <div className="rounded-ds-sm rounded-bl-ds-xsm bg-brand px-4 py-3 text-subtitle text-white">{f.body}</div>
                  <p className="mt-1 text-caption font-light text-ink-muted">{f.as_of} · {f.status.replace("_", " ")} · cites {f.cites.join(", ") || "findings"} · why: {f.reason}</p>
                </li>
              ))}
            </Block>
            <Block title="MoldFlow events">
              {d.moldflow_events.length === 0 && <li className="text-subtitle text-ink-muted">Run the Job 1 review flow to populate.</li>}
              {d.moldflow_events.map((e, i) => <li key={i} className="text-subtitle text-ink"><span className="text-caption text-ink-muted">{e.at_text}</span> <b className="font-semibold">{e.step}.</b> {e.what}</li>)}
            </Block>
          </div>
        </Card>
      </div>
      <p className="mt-4 text-caption font-light text-ink-muted">Elapsed time is not staff labour. The left column is recorded fact; the right column is a prototype run on seeded data; conversion impact is projected, not measured.</p>
    </StaffShell>
  );
}

function Counter({ icon: Icon, label, before, after, note }: { icon: typeof Clock; label: string; before: string; after: string; note?: string }) {
  return (
    <Card className="rise p-5">
      <p className="flex items-center gap-2 text-subtitle font-medium text-ink"><Icon size={16} className="shrink-0 text-brand" aria-hidden />{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-ds-xsm bg-alert-danger-bg p-3"><Eyebrow color="text-kit-red">Before</Eyebrow><p className="mt-0.5 text-subheading font-semibold text-ink">{before}</p></div>
        <div className="rounded-ds-xsm bg-alert-success-bg p-3"><Eyebrow color="text-kit-green">After</Eyebrow><p className="mt-0.5 text-subheading font-semibold text-ink">{after}</p></div>
      </div>
      {note && <p className="mt-2 text-caption font-light text-ink-muted">{note}</p>}
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-subheading font-semibold text-ink">{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
