"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { FileDown, FileSpreadsheet, ShieldCheck, Sparkles, RefreshCw, Lock } from "lucide-react";
import { api, money, photoUrl, type Case, type CaseOut, type Flag } from "@/lib/api";
import { useCase } from "@/lib/useCase";
import { Button, Card, Eyebrow, FlagRow, IconButton, KitSelect, KitTextarea, Modal, ProvenancePill, Spinner, StaffShell, Tag, buttonClass, cx } from "@/components/ui";

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
  const resolve = () => {
    const f = resolving!; setResolving(null);
    run("resolve", () => api.post<CaseOut>(`/cases/${caseId}/flags/${f.id}/resolve`, { note, by: reviewer }));
  };

  return (
    <StaffShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>{c.id} · stage: {c.stage.replace("_", " ")}</Eyebrow>
          <h1 className="mt-1 text-h6 font-semibold text-ink sm:text-h5">{c.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-ink-muted">Drafted by MoldFlow · Reviewed by</span>
          <div className="w-48">
            <KitSelect aria-label="Reviewed by" value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
              {REVIEWERS.map((r) => <option key={r}>{r}</option>)}
            </KitSelect>
          </div>
          <Button disabled={!c.report || blocks.length > 0 || reportApproved || (!!busy && busy !== "approve")} state={busy === "approve" ? "loading" : undefined}
            onClick={() => run("approve", () => api.post<CaseOut>(`/cases/${caseId}/approve`, { what: "report", reviewed_by: reviewer }))}
            title={blocks.length ? "Resolve blocking flags first" : ""}
            leading={blocks.length ? <Lock size={16} aria-hidden /> : <ShieldCheck size={16} aria-hidden />}>
            {reportApproved ? "Approved" : "Approve report"}
          </Button>
          <a href={`/api/cases/${caseId}/export/report.pdf`} target="_blank" rel="noreferrer" className={buttonClass({ variant: "outline" })}><FileDown size={16} aria-hidden />PDF</a>
          {c.estimate && <a href={`/api/cases/${caseId}/export/estimate.csv`} className={buttonClass({ variant: "outline" })}><FileSpreadsheet size={16} aria-hidden />CSV</a>}
        </div>
      </div>

      <Card className="mb-6 border-l-4 border-l-kit-orange p-5">
        <Eyebrow className="mb-1">Customer&apos;s original concern</Eyebrow>
        <p className="text-body text-ink">{c.concern || "—"}</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-subheading font-semibold text-ink">Report draft</h2>
              <div className="flex items-center gap-2">
                {lastReport && <ProvenancePill tier={lastReport.tier} ms={lastReport.latency_ms} model={lastReport.model} />}
                <Button variant={c.report ? "outline" : "primary"} disabled={!!busy && busy !== "draft"} state={busy === "draft" ? "loading" : undefined}
                  leading={<Sparkles size={16} aria-hidden />}
                  onClick={() => run("draft", () => api.post<CaseOut>(`/cases/${caseId}/report/draft`))}>
                  {c.report ? "Redraft" : "Draft report from evidence"}
                </Button>
              </div>
            </div>
            {busy === "draft" && <Spinner label="Drafting from confirmed findings, citing every sentence…" />}
            {!c.report && busy !== "draft" && (
              <p className="text-subtitle font-light text-ink-body">
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
              <h2 className="text-subheading font-semibold text-ink">Checks before it goes out</h2>
              <IconButton variant="text" size="sm" label="Re-run checks" onClick={() => run("checks", () => api.post<CaseOut>(`/cases/${caseId}/checks`))}>
                <RefreshCw size={14} aria-hidden className={cx(busy === "checks" && "animate-ds-spin")} />
              </IconButton>
            </div>
            {blocks.length > 0 && <p className="mb-3 text-subtitle font-medium text-kit-red">{blocks.length} blocking issue{blocks.length > 1 ? "s" : ""}: approval is locked.</p>}
            <div className="space-y-2">{c.flags.map((f) => <FlagRow key={f.id} flag={f} onResolve={(fl) => { setResolving(fl); setNote(""); }} />)}</div>
          </Card>
          {c.estimate && <EstimateCard c={c} />}
          {c.pre_assessment && (
            <Card className="p-5">
              <h2 className="text-subheading font-semibold text-ink">Customer pre-assessment</h2>
              <p className="mt-2 text-subtitle font-light text-ink-body">{c.pre_assessment.summary}</p>
              <p className="mt-2 text-subtitle font-semibold text-ink">{c.pre_assessment.service_price_text}</p>
            </Card>
          )}
        </aside>
      </div>
      {err && <Card tone="danger" role="alert" className="mt-4 p-3 text-subtitle text-kit-red">{err}</Card>}

      <Modal open={!!resolving} onClose={() => setResolving(null)} title="Resolve with a note" className="max-w-[520px]"
        footer={<>
          <Button variant="text" onClick={() => setResolving(null)}>Cancel</Button>
          <Button disabled={!note.trim()} onClick={resolve}>Resolve as {reviewer.split(" (")[0]}</Button>
        </>}>
        <p>{resolving?.message}</p>
        <KitTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} data-autofocus aria-label="Resolution note" className="mt-3"
          placeholder="e.g. Basement spot is small and under the sink; homeowner can clean it. Exclusion explained in the report." />
      </Modal>
    </StaffShell>
  );
}

function Cite({ c, id }: { c: Case; id: string }) {
  const f = c.findings.find((x) => x.id === id);
  const pid = f ? f.evidence_photo_ids[0] : id;
  const p = c.photos.find((x) => x.id === pid);
  return (
    <span className="group relative inline-block align-middle" tabIndex={p ? 0 : undefined}>
      <Tag tone="blue" soft className="cursor-help">{id}</Tag>
      {p && (
        <span className="pointer-events-none absolute bottom-7 left-0 z-20 hidden w-48 rounded-ds-xsm border border-kit-gray-soft bg-white p-1.5 shadow-ds-lg group-hover:block group-focus:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(c.id, p.id)} alt="" className="h-32 w-full rounded-ds-xsm object-cover" />
          <span className="mt-1 block text-caption font-light text-ink-muted">{p.id} · {p.caption_from_pack ?? f?.observation}</span>
        </span>
      )}
    </span>
  );
}

function ReportView({ c }: { c: Case }) {
  const r = c.report!.draft;
  return (
    <div className="space-y-5 text-body text-ink">
      <p>{r.summary}</p>
      {r.sections.map((s) => (
        <div key={s.room}>
          <h3 className="mb-1.5 text-subheading font-semibold text-kit-blue">{s.room}</h3>
          <ul className="space-y-1.5">
            {s.claims.map((cl, i) => (
              <li key={i}>► {cl.text} <span className="inline-flex gap-1">{cl.cites.map((x) => <Cite key={x} c={c} id={x} />)}</span></li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="mb-1.5 text-subheading font-semibold text-kit-blue">Recommendations</h3>
        <ul className="space-y-1.5">{r.recommendations.map((cl, i) => (
          <li key={i}>► {cl.text} <span className="inline-flex gap-1">{cl.cites.map((x) => <Cite key={x} c={c} id={x} />)}</span></li>))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1.5 text-subheading font-semibold text-kit-blue">Limitations</h3>
        <ul className="list-disc pl-5 text-subtitle font-light text-ink-body">{r.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
      {c.report!.dropped_claims.length > 0 && (
        <p className="rounded-ds-xsm bg-kit-gray-faint p-2 text-caption text-ink-muted">{c.report!.dropped_claims.length} uncited sentence(s) removed by the evidence check.</p>
      )}
    </div>
  );
}

function EstimateCard({ c }: { c: Case }) {
  const e = c.estimate!;
  return (
    <Card className="relative overflow-hidden p-5">
      <h2 className="text-subheading font-semibold text-ink">Estimate {e.id}</h2>
      <p className="mt-1 text-caption font-light text-ink-muted">{e.service} · {e.areas.join(" · ")}{e.duration_text ? ` · ${e.duration_text}` : ""}</p>
      {e.line_items.length > 0 && (
        <div className="relative mt-3">
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="eyebrow -rotate-12 rounded-ds-xsm border-2 border-kit-orange/50 px-2 py-1 text-kit-orange/70">ILLUSTRATIVE · MB SETS PRICING</span>
          </span>
          <table className="w-full text-subtitle">
            <tbody>{e.line_items.map((li) => (
              <tr key={li.code} className="border-b border-kit-gray-soft">
                <td className="py-2 pr-2 font-light text-ink-body">{li.description}</td>
                <td className="py-2 text-right tabular-nums text-ink">{money(li.unit_price)}</td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="mt-3 space-y-1 text-subtitle tabular-nums text-ink-body">
        <Row k="Subtotal" v={money(e.subtotal)} />
        <Row k={e.tax_label} v={money(e.tax)} />
        <Row k="Total" v={money(e.total)} bold />
        {e.deposit && <Row k={`Deposit (${e.deposit_pct}%)`} v={money(e.deposit)} />}
        {e.expires_on && <Row k="Valid until" v={e.expires_on} />}
      </dl>
      {e.real_world_status && <p className="mt-3 rounded-ds-xsm bg-alert-warning-bg p-2 text-caption font-medium text-[#8a5a0a]">Recorded outcome: {e.real_world_status}</p>}
    </Card>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={cx("flex justify-between", bold && "border-t border-kit-gray-soft pt-1 text-body font-semibold text-ink")}><dt>{k}</dt><dd>{v}</dd></div>;
}
