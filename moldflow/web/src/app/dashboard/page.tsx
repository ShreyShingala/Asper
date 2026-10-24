"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, MessageSquareText, FileCheck2, UserPlus, RotateCcw, CheckCheck } from "lucide-react";
import { api, money } from "@/lib/api";
import { Button, Card, Spinner, StaffShell, cx } from "@/components/ui";

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
    <StaffShell actions={<Button variant="ghost" className="min-h-9 text-xs" onClick={async () => { if (confirm("Reset the demo data?")) { await api.post("/admin/reset"); localStorage.removeItem("moldflow_case"); load(); } }}><RotateCcw size={14} />Reset demo</Button>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estimates sent, viewed, not accepted (sample pack)" value={money(d.recorded_viewed_not_accepted_total)} tone="rust" />
        <Stat label="Needs a human now" value={String(others.length)} />
        <Stat label="Follow-up drafts awaiting approval" value={String(drafts.length)} />
        <Stat label="Open cases" value={String(d.cases.length)} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 font-display text-2xl font-semibold">Needs you</h2>
          <div className="space-y-2">
            {others.length === 0 && <p className="text-sm text-ink-2">Inbox zero.</p>}
            {others.map((i) => {
              const Icon = i.severity === "block" ? AlertOctagon : ICON[i.kind as keyof typeof ICON] ?? AlertTriangle;
              return (
                <Link key={i.case_id + i.id} href={target(i)}>
                  <Card className={cx("rise mb-2 flex items-start gap-3 p-3 transition hover:-translate-y-0.5",
                    i.severity === "block" && "border-rust/40 bg-rust-2/60", i.kind === "new_lead" && "border-moss/40 bg-moss-2/60")}>
                    <Icon size={18} className={cx("mt-0.5 shrink-0", i.severity === "block" ? "text-rust" : i.kind === "new_lead" ? "text-moss" : "text-amber")} />
                    <div className="min-w-0">
                      <p className="stamp text-ink-2">{i.title}</p>
                      <p className="text-sm leading-snug">{i.text}</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="mb-3 mt-8 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Follow-up drafts</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="min-h-9 text-xs" disabled={busy}
                onClick={async () => { setBusy(true); try { await api.post("/cases/job1/followups/draft", { as_of: "2026-10-09" }); } finally { setBusy(false); load(); } }}>
                {busy ? <Spinner /> : <MessageSquareText size={14} />}Draft for Job 1 (as of Oct 9)
              </Button>
              {drafts.length > 0 && (
                <Button className="min-h-9 text-xs" onClick={async () => {
                  await api.post("/followups/approve-batch", { items: drafts.map((x) => [x.case_id, x.id]), by: "Staff E (client support)" }); load();
                }}><CheckCheck size={14} />Approve all {drafts.length}</Button>
              )}
            </div>
          </div>
          {drafts.map((i) => (
            <Card key={i.id} className="rise mb-2 p-4">
              <p className="stamp text-ink-2">{i.title} · SMS draft</p>
              <p className="mt-1 text-[15px] leading-snug">{i.text}</p>
              {i.reason && <p className="stamp mt-2 text-moss">why: {i.reason}</p>}
            </Card>
          ))}
        </section>

        <section>
          <h2 className="mb-3 font-display text-2xl font-semibold">Cases</h2>
          <Card className="divide-y divide-line">
            {d.cases.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}/review`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-paper-2/60">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="stamp text-ink-2">{c.stage.replace("_", " ")}{c.service ? ` · ${c.service}` : ""}{c.flags ? ` · ${c.flags} open flags` : ""}</p>
                </div>
                <span className="text-sm tabular-nums">{c.total ? money(c.total) : ""}</span>
              </Link>
            ))}
          </Card>
          <p className="stamp mt-3 text-ink-2">This inbox is what an Asana card would link to; MoldFlow doesn&apos;t replace your board.</p>
        </section>
      </div>
    </StaffShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "rust" }) {
  return (
    <Card className="rise p-4">
      <p className={cx("font-display text-3xl font-semibold tabular-nums", tone === "rust" && "text-rust")}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-2">{label}</p>
    </Card>
  );
}
