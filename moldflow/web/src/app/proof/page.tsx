"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Spinner, StaffShell, cx } from "@/components/ui";

type Row = { photo: string; job: string; caption: string; image_type: string; observations: string[]; regions: number; declined_to_confirm_mold: boolean;
  mentions_mold_as_fact: boolean; tier: string; latency_ms: number; error?: string };
type Proof = {
  eval: { model: string; run_at: string; rows: Row[]; summary: Record<string, number | string> } | null;
  usage_by_agent: Record<string, { calls: number; avg_s: number; tokens_in: number; tokens_out: number; cost: number }>;
  calls_total: number; live_calls: number; model: string;
};

export default function ProofPage() {
  const [d, setD] = useState<Proof | null>(null);
  useEffect(() => { api.get<Proof>("/proof").then(setD); }, []);
  if (!d) return <StaffShell><Spinner label="Loading…" /></StaffShell>;
  const s = d.eval?.summary;
  return (
    <StaffShell title="Proof: what's measured, projected, simulated">
      <div className="grid gap-3 md:grid-cols-3">
        <Legend tone="moss" title="Measured (live in this prototype)"
          body="AI latency and tokens per call; AI photo descriptions vs organizer photo captions (n=24, illustrative, NOT an accuracy benchmark); how often the AI declined to confirm mold." />
        <Legend tone="amber" title="Projected (not measured)"
          body="Turnaround reduction (recorded: report emailed 45h 35m after inspection = elapsed; the write/review window was 82 min with 2 staff); staff touches per case; conversion of the $4,778.87 in sent-but-unaccepted estimates." />
        <Legend tone="ink" title="Simulated"
          body="SMS/email sending, booking, payment, CRM/FreshBooks/Calendar sync, customer identities, seeded inspector inputs (from job_timeline.json + photo filenames; reference reports never used as model input)." />
      </div>

      {s && (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {Object.entries(s).map(([k, v]) => (
            <Card key={k} className="p-4"><p className="font-display text-3xl font-semibold tabular-nums">{String(v)}</p><p className="mt-1 text-xs text-ink-2">{k}</p></Card>
          ))}
        </div>
      )}

      <Card className="mt-6 overflow-x-auto p-0">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="font-display text-xl font-semibold">AI description vs organizer caption</h2>
          <p className="stamp text-ink-2">{d.eval ? `${d.eval.model} · ${d.eval.run_at}` : "run scripts/eval_photos.py"}</p>
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="stamp bg-paper-2 text-left text-ink-2">
            <tr><th className="px-4 py-2">Photo</th><th className="px-4 py-2">Organizer caption</th><th className="px-4 py-2">AI observations</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Declined to confirm mold?</th><th className="px-4 py-2">s</th></tr>
          </thead>
          <tbody>
            {(d.eval?.rows ?? []).map((r) => (
              <tr key={r.photo} className="border-t border-line align-top">
                <td className="stamp px-4 py-2">{r.job}/{r.photo}</td>
                <td className="px-4 py-2">{r.caption}</td>
                <td className="px-4 py-2 text-ink-2">{r.error ? <span className="text-rust">{r.error}</span> : r.observations.slice(0, 2).join(" · ")}</td>
                <td className="stamp px-4 py-2">{r.image_type}</td>
                <td className={cx("px-4 py-2 font-medium", r.declined_to_confirm_mold && !r.mentions_mold_as_fact ? "text-moss" : "text-rust")}>
                  {r.error ? "—" : r.declined_to_confirm_mold && !r.mentions_mold_as_fact ? "yes" : "NO: overclaim"}
                </td>
                <td className="stamp px-4 py-2">{(r.latency_ms / 1000).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-xl font-semibold">AI usage in this session (live calls only)</h2>
        <p className="stamp mt-1 text-ink-2">{d.live_calls} live of {d.calls_total} total calls · primary model {d.model} (free tier: $0.00 per call)</p>
        <table className="mt-3 w-full text-sm tabular-nums">
          <thead className="stamp text-left text-ink-2"><tr><th>Agent</th><th>Calls</th><th>Avg latency</th><th>Tokens in/out</th><th>Cost</th></tr></thead>
          <tbody>{Object.entries(d.usage_by_agent).map(([a, u]) => (
            <tr key={a} className="border-t border-line"><td className="py-1.5">{a}</td><td>{u.calls}</td><td>{u.avg_s}s</td><td>{u.tokens_in}/{u.tokens_out}</td><td>${u.cost.toFixed(4)}</td></tr>
          ))}</tbody>
        </table>
        <p className="mt-3 text-xs text-ink-2">At paid Gemini 2.5 Flash rates ($0.30/M in, $2.50/M out) a full case (≈4 photos + pre-assessment + findings + report + 1 follow-up ≈ 25k in / 5k out tokens) is ≈ $0.02. Remaining human steps: inspection visit, one report review, one approval, follow-up approval.</p>
      </Card>
    </StaffShell>
  );
}

function Legend({ tone, title, body }: { tone: "moss" | "amber" | "ink"; title: string; body: string }) {
  return (
    <Card className={cx("border-t-4 p-4", tone === "moss" && "border-t-moss", tone === "amber" && "border-t-amber", tone === "ink" && "border-t-ink-2")}>
      <p className="font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-snug text-ink-2">{body}</p>
    </Card>
  );
}
