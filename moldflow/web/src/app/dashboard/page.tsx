"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, MessageSquareText, FileCheck2, UserPlus, RotateCcw, CheckCheck, ChevronRight } from "lucide-react";
import { api, money } from "@/lib/api";
import { Button, Card, EmptyState, Eyebrow, Spinner, StaffShell, Tag, cx } from "@/components/ui";

type Item = { case_id: string; title: string; kind: string; severity: string; text: string; id: string; reason?: string };
type Dash = {
  cases: { id: string; title: string; stage: string; service?: string; flags: number; total?: string; estimate_status?: string; created_at: string }[];
  inbox: Item[]; pipeline_total: string; recorded_viewed_not_accepted_total: string;
};
const ICON = { flag: AlertTriangle, followup: MessageSquareText, approval: FileCheck2, new_lead: UserPlus } as const;

export default function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setD(await api.get<Dash>("/dashboard")), []);
  useEffect(() => {
    const tick = () => { api.get<Dash>("/dashboard").then(setD); };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [load]);
  if (!d) return <StaffShell><Spinner label="Loading…" /></StaffShell>;
  const drafts = d.inbox.filter((i) => i.kind === "followup");
  const others = d.inbox.filter((i) => i.kind !== "followup");
  const target = (i: Item) => (i.kind === "new_lead" ? `/cases/${i.case_id}/review` : i.case_id.startsWith("job") ? `/cases/${i.case_id}/review` : `/cases/${i.case_id}/review`);

  return (
    <StaffShell actions={<Button variant="text" size="sm" leading={<RotateCcw size={14} aria-hidden />} onClick={async () => { if (confirm("Reset the demo data?")) { await api.post("/admin/reset"); localStorage.removeItem("moldflow_case"); load(); } }}>Reset demo</Button>}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estimates sent, viewed, not accepted (sample pack)" value={money(d.recorded_viewed_not_accepted_total)} tone="red" />
        <Stat label="Needs a human now" value={String(others.length)} />
        <Stat label="Follow-up drafts awaiting approval" value={String(drafts.length)} />
        <Stat label="Open cases" value={String(d.cases.length)} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-h6 font-semibold text-ink">Needs you</h2>
          <div className="space-y-2">
            {others.length === 0 && <EmptyState title="Inbox zero" description="Nothing needs a human right now." />}
            {others.map((i) => {
              const Icon = i.severity === "block" ? AlertOctagon : ICON[i.kind as keyof typeof ICON] ?? AlertTriangle;
              const tone = i.severity === "block" ? "red" : i.kind === "new_lead" ? "green" : "orange";
              return (
                <Link key={i.case_id + i.id} href={target(i)} className="block">
                  <Card tone={tone === "red" ? "danger" : tone === "green" ? "success" : undefined}
                    className="rise flex items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-ds-normal">
                    <Icon size={18} aria-hidden className={cx("mt-0.5 shrink-0", tone === "red" ? "text-kit-red" : tone === "green" ? "text-kit-green" : "text-kit-orange")} />
                    <div className="min-w-0 flex-1">
                      <Eyebrow>{i.title}</Eyebrow>
                      <p className="text-subtitle text-ink">{i.text}</p>
                    </div>
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-h6 font-semibold text-ink">Follow-up drafts</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" state={busy ? "loading" : undefined} leading={<MessageSquareText size={14} aria-hidden />}
                onClick={async () => { setBusy(true); try { await api.post("/cases/job1/followups/draft", { as_of: "2026-10-09" }); } finally { setBusy(false); load(); } }}>
                Draft for Job 1 (as of Oct 9)
              </Button>
              {drafts.length > 0 && (
                <Button size="sm" leading={<CheckCheck size={14} aria-hidden />} onClick={async () => {
                  await api.post("/followups/approve-batch", { items: drafts.map((x) => [x.case_id, x.id]), by: "Staff E (client support)" }); load();
                }}>Approve all {drafts.length}</Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {drafts.map((i) => (
              <Card key={i.id} className="rise p-4">
                <div className="flex items-center gap-2">
                  <Eyebrow>{i.title}</Eyebrow>
                  <Tag tone="blue" soft>SMS draft</Tag>
                </div>
                <p className="mt-2 text-body text-ink">{i.text}</p>
                {i.reason && <p className="mt-2 text-caption text-kit-blue">why: {i.reason}</p>}
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-h6 font-semibold text-ink">Cases</h2>
          <Card className="divide-y divide-kit-gray-soft">
            {d.cases.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}/review`} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-kit-gray-faint">
                <div className="min-w-0">
                  <p className="truncate text-subtitle font-medium text-ink">{c.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Tag soft>{c.stage.replace("_", " ")}</Tag>
                    {c.service && <span className="text-caption font-light text-ink-muted">{c.service}</span>}
                    {c.flags > 0 && <Tag tone="red" soft>{c.flags} open flags</Tag>}
                  </div>
                </div>
                <span className="text-subtitle font-medium tabular-nums text-ink">{c.total ? money(c.total) : ""}</span>
              </Link>
            ))}
          </Card>
          <p className="mt-3 text-caption font-light text-ink-muted">This inbox is what an Asana card would link to; MoldFlow doesn&apos;t replace your board.</p>
        </section>
      </div>
    </StaffShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" }) {
  return (
    <Card className="rise p-5">
      <p className={cx("text-h5 font-semibold tabular-nums", tone === "red" ? "text-kit-red" : "text-ink")}>{value}</p>
      <p className="mt-1 text-caption font-light text-ink-body">{label}</p>
    </Card>
  );
}
