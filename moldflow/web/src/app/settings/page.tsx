"use client";
import { useEffect, useState } from "react";
import { Lock, ShieldOff } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Spinner, StaffShell, Tag } from "@/components/ui";

type Autonomy = { paused: boolean; levels: Record<string, "auto" | "draft" | "off"> };
const LABEL: Record<string, [string, string]> = {
  booking_confirmation: ["Booking confirmations", "Logistics only"], reminder: ["Appointment reminders", "48 h and 2 h before"],
  faq_reply: ["Instant answers", "Booking requests, reschedules, thanks, and the fixed health-question reply"], receipt: ["Receipts", "Numbers come from FreshBooks"],
  inbound_reply: ["Other replies", "Anything the AI writes freely"], estimate_chase: ["Estimate follow-ups", "Has a dollar amount"],
  storm_safety: ["Storm safety messages", "No offer, no link"], storm_offer: ["Storm check-ins with an offer", "Commercial message under CASL"],
  moment: ["Seasonal / life-moment messages", "Uses what we know about them"], manual: ["Staff messages", "Written by a person"],
};
const LOCKED = new Set(["estimate_chase"]);
const PROCESSORS = [
  ["OpenRouter (Nemotron, free tier)", "US", "Photos, call transcripts and messages for AI drafting", "Needs a data processing agreement and a Law 25 privacy impact assessment before production"],
  ["ElevenLabs", "US", "Live voice calls (Bruce)", "Same; callers hear a recording disclosure"],
  ["Twilio (not connected)", "US", "SMS delivery", "Planned"], ["Resend (not connected)", "US", "Email delivery", "Planned"],
  ["Environment Canada", "Canada", "Public weather alerts (no personal data sent)", "Live"],
];

export default function SettingsPage() {
  const [a, setA] = useState<Autonomy | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { api.get<Autonomy>("/settings/autonomy").then(setA); }, []);
  if (!a) return <StaffShell><Spinner label="Loading…" /></StaffShell>;
  const set = (k: string, v: "auto" | "draft" | "off") => { setA({ ...a, levels: { ...a.levels, [k]: v } }); setSaved(false); };
  return (
    <StaffShell title="What the AI may do on its own">
      <Card className="mb-6 flex flex-wrap items-center gap-3 p-5">
        <ShieldOff className="text-kit-red" aria-hidden />
        <p className="flex-1 text-subtitle text-ink">Kill switch: {a.paused ? <b className="text-kit-red">all outbound is paused.</b> : "outbound is running."} It is also in the header of every staff page.</p>
        <Button variant={a.paused ? "primary" : "danger"} onClick={async () => setA(await api.post<Autonomy>("/settings/pause", { paused: !a.paused }))}>{a.paused ? "Resume" : "Pause everything"}</Button>
      </Card>
      <Card className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">Autonomy per message type</caption>
          <thead className="bg-kit-gray-faint text-[12px] text-ink-muted"><tr><th scope="col" className="px-4 py-3">Message type</th><th scope="col" className="px-4 py-3">Mode</th></tr></thead>
          <tbody>
            {Object.entries(a.levels).map(([k, v]) => (
              <tr key={k} className="border-t border-kit-gray-soft">
                <td className="px-4 py-3"><p className="text-subtitle font-medium text-ink">{LABEL[k]?.[0] ?? k}</p><p className="text-caption text-ink-muted">{LABEL[k]?.[1]}</p></td>
                <td className="px-4 py-3">
                  {LOCKED.has(k) ? <Tag tone="orange" soft className="gap-1"><Lock size={11} aria-hidden />Always needs a person</Tag> : (
                    <div className="flex gap-1">{(["auto", "draft", "off"] as const).map((m) => (
                      <button key={m} onClick={() => set(k, m)} aria-pressed={v === m}
                        className={`rounded-full px-3 py-1 text-caption ${v === m ? "bg-brand text-white" : "bg-kit-gray-faint text-ink-body"}`}>
                        {m === "auto" ? "Send on its own" : m === "draft" ? "Draft for approval" : "Off"}</button>
                    ))}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-caption text-ink-muted">Always locked, whatever the setting: anything with a dollar amount, anything that mentions what we know about someone, health or mould identity. Consent rules apply to every message, including auto ones.</p>
      <Button className="mt-3" onClick={async () => { await fetch("/api/settings/autonomy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a) }); setSaved(true); }}>Save</Button>
      {saved && <span role="status" className="ml-3 text-subtitle text-kit-green">Saved</span>}

      <h2 className="mt-10 text-subheading font-semibold text-ink">Who processes customer data</h2>
      <Card className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">Data processors</caption>
          <thead className="bg-kit-gray-faint text-[12px] text-ink-muted"><tr>{["Service", "Country", "What it gets", "Status"].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>{PROCESSORS.map((p) => <tr key={p[0]} className="border-t border-kit-gray-soft">{p.map((x, i) => <td key={i} className="px-4 py-3">{x}</td>)}</tr>)}</tbody>
        </table>
      </Card>
    </StaffShell>
  );
}
