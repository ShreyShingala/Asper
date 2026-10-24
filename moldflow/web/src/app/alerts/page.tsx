"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CloudRain, RadioTower, Send } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, EmptyState, Spinner, StaffShell, Tag } from "@/components/ui";
import { SyntheticTag, dayTime, type AlertView } from "@/components/hub";

const ZONES = ["Gatineau", "City of Ottawa", "Metro Montréal - Laval", "City of Toronto"];
const PRI: Record<number, string> = { 1: "asked for storm check-ins", 2: "past water / basement issue", 3: "in the area" };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertView[] | null>(null);
  const [zone, setZone] = useState("Gatineau");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get<AlertView[]>("/alerts").then(setAlerts), []);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<string>) => { setBusy(true); try { setMsg(await fn()); await load(); } catch (e) { setMsg(String(e)); } finally { setBusy(false); } };

  return (
    <StaffShell title="Weather alerts">
      <Card className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <RadioTower size={18} className="text-ink-muted" aria-hidden />
        <p className="flex-1 text-subtitle text-ink-body">Live Environment Canada alerts are checked for rainfall, flooding and freezing rain over Ontario and Quebec, then matched to past customers by postal area.</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
          const r = await api.post<{ live: boolean; reason?: string; water_alerts_in_on_qc?: number; new: number; matched?: number }>("/alerts/poll");
          return r.live ? `Checked Environment Canada: ${r.water_alerts_in_on_qc} water-related alerts in ON/QC right now, ${r.new} new, ${r.matched ?? 0} customer matches.` : `Live check skipped: ${r.reason}`;
        })}>Check Environment Canada now</Button>
        <span className="mx-1 h-6 w-px bg-kit-gray-soft" />
        <label className="sr-only" htmlFor="zone">Zone</label>
        <select id="zone" value={zone} onChange={(e) => setZone(e.target.value)} className="h-9 rounded-ds-xsm border border-kit-gray-soft px-2 text-subtitle">
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <Button size="sm" leading={<CloudRain size={14} aria-hidden />} disabled={busy}
          onClick={() => run(async () => { const r = await api.post<AlertView>("/alerts/simulate", { zone }); return `Simulated rainfall warning over ${zone}: ${r.matched.length} past customers matched.`; })}>
          Simulate rainfall warning</Button>
      </Card>
      {msg && <p role="status" className="mb-4 rounded-ds-sm bg-brand-tint p-3 text-subtitle text-brand-strong">{msg}</p>}
      {!alerts ? <Spinner label="Loading…" /> : alerts.length === 0 ? <Card className="p-6"><EmptyState title="No active water-related alerts" /></Card> : (
        <div className="space-y-6">
          {alerts.map((v) => (
            <Card key={v.alert.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex flex-wrap items-center gap-2 text-subheading font-semibold capitalize text-ink"><CloudRain size={18} aria-hidden />{v.alert.type} · {v.alert.area}
                    <Tag tone={v.alert.source === "simulated" ? "gray" : "orange"} soft>{v.alert.source === "simulated" ? "simulated" : "Environment Canada"}</Tag></h2>
                  <p className="mt-1 max-w-3xl text-caption text-ink-muted">{v.alert.text_en.slice(0, 260)}</p>
                  <p className="text-caption text-ink-muted">{dayTime(v.alert.starts)} → {dayTime(v.alert.ends)}</p>
                </div>
                <Button leading={<Send size={15} aria-hidden />} disabled={busy || !v.matched.length} onClick={() => run(async () => {
                  const r = await api.post<{ offer: number; safety: number; skipped: number }>(`/alerts/${v.alert.id}/draft`);
                  return `${r.offer} check-ins with an offer (consent on file), ${r.safety} safety-only messages (no offer), ${r.skipped} skipped. Review them in Outreach.`;
                })}>Draft check-ins</Button>
              </div>
              <table className="mt-4 w-full text-left text-[13px]">
                <caption className="sr-only">Matched customers</caption>
                <thead className="text-[12px] text-ink-muted"><tr>{["Customer", "Why", "Language", "Marketing consent"].map((h) => <th key={h} scope="col" className="py-2 pr-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {v.matched.map((m) => (
                    <tr key={m.contact_id as string} className="border-t border-kit-gray-soft">
                      <td className="py-2 pr-3"><Link href={`/people/${m.contact_id}`} className="font-medium text-ink hover:text-brand">{m.name as string}</Link> <SyntheticTag show={m.synthetic as boolean} /></td>
                      <td className="py-2 pr-3"><Tag tone={m.priority === 1 ? "brand" : m.priority === 2 ? "orange" : "gray"} soft>{PRI[m.priority as number]}</Tag> <span className="text-caption text-ink-muted">{(m.reason as string).split("·")[1]}</span></td>
                      <td className="py-2 pr-3 uppercase">{m.language as string}</td>
                      <td className="py-2 pr-3">{m.marketing_ok ? <Tag tone="green" soft>yes: offer allowed</Tag> : <span className="text-caption text-ink-muted">{m.consent as string}: safety message only</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-caption text-ink-muted"><Link href="/outreach" className="font-medium text-brand">Review drafted check-ins in Outreach →</Link></p>
            </Card>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
