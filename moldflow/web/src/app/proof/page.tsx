"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner, StaffShell, Tag, cx } from "@/components/ui";

type Row = { photo: string; job: string; caption: string; image_type: string; observations: string[]; regions: number; declined_to_confirm_mold: boolean;
  mentions_mold_as_fact: boolean; tier: string; latency_ms: number; error?: string };
type Proof = {
  eval: { model: string; run_at: string; rows: Row[]; summary: Record<string, number | string> } | null;
  usage_by_agent: Record<string, { calls: number; avg_s: number; tokens_in: number; tokens_out: number; cost: number }>;
  calls_total: number; live_calls: number; model: string;
};

const TH = "px-4 py-3 font-medium";

export default function ProofPage() {
  const [d, setD] = useState<Proof | null>(null);
  useEffect(() => { api.get<Proof>("/proof").then(setD); }, []);
  if (!d) return <StaffShell><Spinner label="Loading…" /></StaffShell>;
  const s = d.eval?.summary;
  return (
    <StaffShell title="Proof: what's measured, projected, simulated">
      <div className="grid gap-4 md:grid-cols-3">
        <Legend tone="green" title="Measured (live in this prototype)"
          body="AI latency and tokens per call; AI photo descriptions vs organizer photo captions (n=24, illustrative, NOT an accuracy benchmark); how often the AI declined to confirm mold." />
        <Legend tone="orange" title="Projected (not measured)"
          body="Turnaround reduction (recorded: report emailed 45h 35m after inspection = elapsed; the write/review window was 82 min with 2 staff); staff touches per case; conversion of the $4,778.87 in sent-but-unaccepted estimates." />
        <Legend tone="navy" title="Simulated"
          body="SMS/email sending, booking, payment, CRM/FreshBooks/Calendar sync, customer identities, seeded inspector inputs (from job_timeline.json + photo filenames; reference reports never used as model input)." />
      </div>

      {s && (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {Object.entries(s).map(([k, v]) => (
            <Card key={k} className="p-5"><p className="text-h5 font-semibold tabular-nums text-ink">{String(v)}</p><p className="mt-1 text-caption font-light text-ink-body">{k}</p></Card>
          ))}
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <h2 className="text-subheading font-semibold text-ink">AI description vs organizer caption</h2>
          <p className="text-caption font-light text-ink-muted">{d.eval ? `${d.eval.model} · ${d.eval.run_at}` : "run scripts/eval_photos.py"}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <caption className="sr-only">AI photo descriptions compared with organizer captions</caption>
            <thead className="bg-kit-gray-faint text-[12px] text-ink-muted">
              <tr className="border-b border-kit-gray-soft">
                <th scope="col" className={TH}>Photo</th><th scope="col" className={TH}>Organizer caption</th><th scope="col" className={TH}>AI observations</th>
                <th scope="col" className={TH}>Type</th><th scope="col" className={TH}>Declined to confirm mold?</th><th scope="col" className={cx(TH, "text-right")}>s</th>
              </tr>
            </thead>
            <tbody>
              {(d.eval?.rows ?? []).map((r) => {
                const ok = r.declined_to_confirm_mold && !r.mentions_mold_as_fact;
                return (
                  <tr key={r.photo} className="border-b border-kit-gray-soft align-top last:border-0 hover:bg-kit-gray-faint/60">
                    <td className="px-4 py-3 text-caption text-ink-muted">{r.job}/{r.photo}</td>
                    <td className="px-4 py-3 text-ink">{r.caption}</td>
                    <td className="px-4 py-3 font-light text-ink-body">{r.error ? <span className="text-kit-red">{r.error}</span> : r.observations.slice(0, 2).join(" · ")}</td>
                    <td className="px-4 py-3"><Tag soft>{r.image_type}</Tag></td>
                    <td className="px-4 py-3">{r.error ? "—" : <Tag tone={ok ? "green" : "red"} soft>{ok ? "yes" : "NO: overclaim"}</Tag>}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-body">{(r.latency_ms / 1000).toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="text-subheading font-semibold text-ink">AI usage in this session (live calls only)</h2>
        <p className="mt-1 text-caption font-light text-ink-muted">{d.live_calls} live of {d.calls_total} total calls · primary model {d.model} (free tier: $0.00 per call)</p>
        <div className="mt-4 overflow-x-auto rounded-ds-xsm bg-kit-gray-faint">
          <table className="w-full border-collapse text-left text-[13px] tabular-nums">
            <caption className="sr-only">AI usage by agent</caption>
            <thead className="text-[12px] text-ink-muted">
              <tr className="border-b border-kit-gray-soft">
                <th scope="col" className={TH}>Agent</th><th scope="col" className={TH}>Calls</th><th scope="col" className={TH}>Avg latency</th><th scope="col" className={TH}>Tokens in/out</th><th scope="col" className={TH}>Cost</th>
              </tr>
            </thead>
            <tbody>{Object.entries(d.usage_by_agent).map(([a, u]) => (
              <tr key={a} className="border-b border-kit-gray-soft text-ink-body last:border-0">
                <td className="px-4 py-2.5 font-medium text-ink">{a}</td><td className="px-4 py-2.5">{u.calls}</td><td className="px-4 py-2.5">{u.avg_s}s</td>
                <td className="px-4 py-2.5">{u.tokens_in}/{u.tokens_out}</td><td className="px-4 py-2.5">${u.cost.toFixed(4)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-caption font-light text-ink-body">At paid Gemini 2.5 Flash rates ($0.30/M in, $2.50/M out) a full case (≈4 photos + pre-assessment + findings + report + 1 follow-up ≈ 25k in / 5k out tokens) is ≈ $0.02. Remaining human steps: inspection visit, one report review, one approval, follow-up approval.</p>
      </Card>
    </StaffShell>
  );
}

function Legend({ tone, title, body }: { tone: "green" | "orange" | "navy"; title: string; body: string }) {
  return (
    <Card className={cx("border-t-4 p-5", tone === "green" && "border-t-kit-green", tone === "orange" && "border-t-kit-orange", tone === "navy" && "border-t-kit-navy")}>
      <h2 className="text-subheading font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-subtitle font-light text-ink-body">{body}</p>
    </Card>
  );
}
