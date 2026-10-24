"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { FileDown, FileSpreadsheet, ShieldCheck, Sparkles, RefreshCw, Lock } from "lucide-react";
import { api, money, photoUrl, type Case, type CaseOut, type Flag } from "@/lib/api";
import { useCase } from "@/lib/useCase";
import { Button, Card, FlagRow, ProvenancePill, Spinner, StaffShell, cx } from "@/components/ui";

const REVIEWERS = ["Staff C (admin)", "Staff D (admin)", "Staff B (inspector)"];

export default function Review() {
  const { caseId } = useParams<{ caseId: string }>();
  const { c, err, busy, run } = useCase(caseId);
  const [reviewer, setReviewer] = useState(REVIEWERS[1]);
  const [resolving, setResolving] = useState<Flag | null>(null);
  const [note, setNote] = useState("");
  if (!c) return <StaffShell><Spinner label="Loading case…" /></StaffShell>;
  const blocks = c.flags.filter((f) => f.severity === "block" && !f.resolved);
  const reportApproved = c.approvals.some((a) => a.what === "report");
  const lastReport = [...c.ai_usage].reverse().find((u) => u.agent === "report");

  return (
    <StaffShell>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="stamp text-ink-2">{c.id.toUpperCase()} · STAGE: {c.stage.replace("_", " ")}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{c.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="stamp rounded-lg border border-line bg-card px-2.5 py-2">Drafted by MoldFlow · Reviewed by</span>
          <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="min-h-9 rounded-lg border border-line bg-card px-2 text-sm">
            {REVIEWERS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <Button disabled={!c.report || blocks.length > 0 || reportApproved || !!busy}
            onClick={() => run("approve", () => api.post<CaseOut>(`/cases/${caseId}/approve`, { what: "report", reviewed_by: reviewer }))}
            title={blocks.length ? "Resolve blocking flags first" : ""}>
            {blocks.length ? <Lock size={16} /> : <ShieldCheck size={16} />}{reportApproved ? "Approved" : "Approve report"}
          </Button>
          <a href={`/api/cases/${caseId}/export/report.pdf`} target="_blank" rel="noreferrer"><Button variant="outline"><FileDown size={16} />PDF</Button></a>
          {c.estimate && <a href={`/api/cases/${caseId}/export/estimate.csv`}><Button variant="outline"><FileSpreadsheet size={16} />CSV</Button></a>}
        </div>
      </div>

      <Card className="mb-5 border-l-4 border-l-amber p-4">
        <p className="stamp mb-1 text-ink-2">CUSTOMER&apos;S ORIGINAL CONCERN</p>
        <p className="text-[15px]">{c.concern || "—"}</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">Report draft</h2>
              <div className="flex items-center gap-2">
                {lastReport && <ProvenancePill tier={lastReport.tier} ms={lastReport.latency_ms} model={lastReport.model} />}
                <Button variant={c.report ? "outline" : "primary"} disabled={!!busy}
                  onClick={() => run("draft", () => api.post<CaseOut>(`/cases/${caseId}/report/draft`))}>
                  <Sparkles size={16} />{c.report ? "Redraft" : "Draft report from evidence"}
                </Button>
              </div>
            </div>
            {busy === "draft" && <Spinner label="Drafting from confirmed findings, citing every sentence…" />}
            {!c.report && busy !== "draft" && (
              <p className="text-sm text-ink-2">
                {c.findings.filter((f) => f.confirmed).length} confirmed findings and {c.photos.length} photos are ready. The draft cites a finding or
                photo for every sentence; uncited sentences are removed automatically.
              </p>
            )}
            {c.report && <ReportView c={c} />}
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Checks before it goes out</h2>
              <Button variant="ghost" className="min-h-9 px-2" onClick={() => run("checks", () => api.post<CaseOut>(`/cases/${caseId}/checks`))}><RefreshCw size={14} /></Button>
            </div>
            {blocks.length > 0 && <p className="mb-3 text-sm font-medium text-rust">{blocks.length} blocking issue{blocks.length > 1 ? "s" : ""}: approval is locked.</p>}
            <div className="space-y-2">{c.flags.map((f) => <FlagRow key={f.id} flag={f} onResolve={(fl) => { setResolving(fl); setNote(""); }} />)}</div>
          </Card>
          {c.estimate && <EstimateCard c={c} />}
          {c.pre_assessment && (
            <Card className="p-5">
              <h2 className="font-display text-xl font-semibold">Customer pre-assessment</h2>
              <p className="mt-2 text-sm">{c.pre_assessment.summary}</p>
              <p className="mt-2 text-sm font-semibold">{c.pre_assessment.service_price_text}</p>
            </Card>
          )}
        </aside>
      </div>
      {err && <p className="mt-4 rounded-xl bg-rust-2 p-3 text-sm text-rust">{err}</p>}

      {resolving && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={() => setResolving(null)}>
          <Card className="rise w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-semibold">Resolve with a note</h3>
            <p className="mt-2 text-sm text-ink-2">{resolving.message}</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoFocus
              placeholder="e.g. Basement spot is small and under the sink; homeowner can clean it. Exclusion explained in the report."
              className="mt-3 w-full rounded-xl border border-ink/15 bg-white p-3 outline-none focus:border-moss" />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResolving(null)}>Cancel</Button>
              <Button disabled={!note.trim()} onClick={() => {
                const f = resolving; setResolving(null);
                run("resolve", () => api.post<CaseOut>(`/cases/${caseId}/flags/${f.id}/resolve`, { note, by: reviewer }));
              }}>Resolve as {reviewer.split(" (")[0]}</Button>
            </div>
          </Card>
        </div>
      )}
    </StaffShell>
  );
}

function Cite({ c, id }: { c: Case; id: string }) {
  const f = c.findings.find((x) => x.id === id);
  const pid = f ? f.evidence_photo_ids[0] : id;
  const p = c.photos.find((x) => x.id === pid);
  return (
    <span className="group relative inline-block">
      <span className="stamp cursor-help rounded bg-moss-2 px-1 py-0.5 text-moss">{id}</span>
      {p && (
        <span className="pointer-events-none absolute bottom-6 left-0 z-20 hidden w-48 rounded-xl border border-line bg-card p-1.5 shadow-xl group-hover:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(c.id, p.id)} alt="" className="h-32 w-full rounded-lg object-cover" />
          <span className="stamp mt-1 block text-ink-2">{p.id} · {p.caption_from_pack ?? f?.observation}</span>
        </span>
      )}
    </span>
  );
}

function ReportView({ c }: { c: Case }) {
  const r = c.report!.draft;
  return (
    <div className="space-y-4 text-[15px] leading-relaxed">
      <p>{r.summary}</p>
      {r.sections.map((s) => (
        <div key={s.room}>
          <h3 className="mb-1 font-display text-lg font-semibold text-moss">{s.room}</h3>
          <ul className="space-y-1.5">
            {s.claims.map((cl, i) => (
              <li key={i}>► {cl.text} <span className="inline-flex gap-1">{cl.cites.map((x) => <Cite key={x} c={c} id={x} />)}</span></li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold text-moss">Recommendations</h3>
        <ul className="space-y-1.5">{r.recommendations.map((cl, i) => (
          <li key={i}>► {cl.text} <span className="inline-flex gap-1">{cl.cites.map((x) => <Cite key={x} c={c} id={x} />)}</span></li>))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 font-display text-lg font-semibold text-moss">Limitations</h3>
        <ul className="list-disc pl-5 text-sm text-ink-2">{r.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      {c.report!.dropped_claims.length > 0 && (
        <p className="stamp rounded-lg bg-paper-2 p-2 text-ink-2">{c.report!.dropped_claims.length} uncited sentence(s) removed by the evidence check.</p>
      )}
    </div>
  );
}

function EstimateCard({ c }: { c: Case }) {
  const e = c.estimate!;
  return (
    <Card className="relative overflow-hidden p-5">
      <h2 className="font-display text-xl font-semibold">Estimate {e.id}</h2>
      <p className="stamp mt-1 text-ink-2">{e.service} · {e.areas.join(" · ")}{e.duration_text ? ` · ${e.duration_text}` : ""}</p>
      {e.line_items.length > 0 && (
        <div className="relative mt-3">
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="stamp -rotate-12 rounded border-2 border-amber/50 px-2 py-1 text-amber/70">ILLUSTRATIVE · MB SETS PRICING</span>
          </span>
          <table className="w-full text-sm">
            <tbody>{e.line_items.map((li) => (
              <tr key={li.code} className="border-b border-line/70">
                <td className="py-1.5 pr-2 text-ink-2">{li.description}</td>
                <td className="py-1.5 text-right tabular-nums">{money(li.unit_price)}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="mt-3 space-y-1 text-sm tabular-nums">
        <Row k="Subtotal" v={money(e.subtotal)} />
        <Row k={e.tax_label} v={money(e.tax)} />
        <Row k="Total" v={money(e.total)} bold />
        {e.deposit && <Row k={`Deposit (${e.deposit_pct}%)`} v={money(e.deposit)} />}
        {e.expires_on && <Row k="Valid until" v={e.expires_on} />}
      </dl>
      {e.real_world_status && <p className={cx("stamp mt-3 rounded-lg bg-amber-2 p-2 text-[#7a4e06]")}>Recorded outcome: {e.real_world_status}</p>}
    </Card>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={cx("flex justify-between", bold && "border-t border-line pt-1 text-base font-semibold")}><dt>{k}</dt><dd>{v}</dd></div>;
}
