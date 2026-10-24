"use client";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Mic, Sparkles, Check, Trash2, Camera, ArrowRight } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { useCase } from "@/lib/useCase";
import { AnnotatedPhoto, Button, Card, ProvenancePill, Spinner, StaffShell, cx } from "@/components/ui";

const KINDS: Record<string, { label: string; options: string[] }> = {
  moisture: { label: "Moisture meter", options: ["elevated", "normal", "not_recorded"] },
  temp_rh_dew: { label: "Humidity / dew point", options: ["elevated", "normal", "not_recorded"] },
  thermal: { label: "Thermal camera", options: ["anomaly", "none", "not_recorded"] },
  swab: { label: "Instant swab", options: ["positive", "negative", "not_recorded"] },
  ball_slope: { label: "Ball-slope test", options: ["failed", "passed", "not_recorded"] },
};

export default function Inspect() {
  const { caseId } = useParams<{ caseId: string }>();
  const { c, err, busy, run } = useCase(caseId);
  const rooms = useMemo(() => [...new Set([...(c?.photos ?? []).map((p) => p.room ?? "Unassigned"), ...(c?.findings ?? []).map((f) => f.room)])], [c]);
  const [room, setRoom] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const file = useRef<HTMLInputElement>(null);
  if (!c) return <StaffShell><Spinner label="Loading case…" /></StaffShell>;
  const active = room ?? (rooms.includes("Upstairs washrooms") ? "Upstairs washrooms" : rooms[0]);
  const photos = c.photos.filter((p) => (p.room ?? "Unassigned") === active);
  const findings = c.findings.filter((f) => f.room === active);
  const readingState = (kind: string) => findings.flatMap((f) => f.readings).find((r) => r.kind === kind)?.result;
  const lastAi = [...c.ai_usage].reverse().find((u) => u.agent === "findings");

  return (
    <StaffShell title={`Inspect · ${c.title}`}
      actions={<Link href={`/cases/${caseId}/review`}><Button className="min-h-9 text-xs">Go to review <ArrowRight size={14} /></Button></Link>}>
      <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
        <aside className="space-y-1">
          <p className="stamp mb-2 text-ink-2">ROOMS</p>
          {rooms.map((r) => (
            <button key={r} onClick={() => setRoom(r)}
              className={cx("w-full rounded-xl px-3 py-2.5 text-left text-sm", r === active ? "bg-ink text-paper" : "hover:bg-paper-2")}>
              {r}
              <span className="stamp ml-2 opacity-60">{c.findings.filter((f) => f.room === r).length}f · {c.photos.filter((p) => p.room === r).length}p</span>
            </button>
          ))}
        </aside>
        <section className="space-y-5">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="stamp text-ink-2">EVIDENCE PHOTOS · {active}</p>
              <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const fd = new FormData(); fd.append("file", f); fd.append("source", "inspector"); fd.append("room", active);
                run("upload", () => api.upload<CaseOut>(`/cases/${caseId}/photos`, fd));
              }} />
              <Button variant="outline" className="min-h-9 text-xs" onClick={() => file.current?.click()}><Camera size={14} />Add photo</Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {photos.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <AnnotatedPhoto caseId={caseId} photo={p} showBoxes={false} className="aspect-[3/4]" />
                  <p className="stamp mt-1 text-ink-2"><b>{p.id}</b> {p.caption_from_pack}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="stamp mb-3 text-ink-2">QUICK-TAP READINGS</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(KINDS).map(([kind, k]) => (
                <div key={kind}>
                  <p className="mb-1.5 text-sm font-medium">{k.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {k.options.map((o) => (
                      <button key={o} disabled={!!busy}
                        onClick={() => run("reading", () => api.post<CaseOut>(`/cases/${caseId}/readings`, { room: active, kind, result: o }))}
                        className={cx("min-h-9 rounded-lg border px-2.5 text-xs", readingState(kind) === o ? "border-moss bg-moss text-white" : "border-ink/15 bg-card hover:bg-paper-2")}>
                        {o.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="stamp mb-2 text-ink-2">FIELD NOTE → STRUCTURED FINDINGS</p>
            <div className="relative">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="Type or dictate (keyboard mic), e.g. 'Tub faucet leaking, moisture meter shows elevated moisture below the faucet.'"
                className="w-full rounded-xl border border-ink/15 bg-white p-3 pr-10 text-base outline-none focus:border-moss" />
              <Mic size={18} className="absolute right-3 top-3 text-ink-2" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Button disabled={!note.trim() || !!busy}
                onClick={() => run("note", () => api.post<CaseOut>(`/cases/${caseId}/findings/from-note`, { room: active, text: note }).then((o) => { setNote(""); return o; }))}>
                <Sparkles size={16} />Structure with AI
              </Button>
              {busy === "note" && <Spinner label="Structuring the note…" />}
              {lastAi && busy !== "note" && <ProvenancePill tier={lastAi.tier} ms={lastAi.latency_ms} model={lastAi.model} />}
            </div>
          </Card>

          <div className="space-y-2">
            <p className="stamp text-ink-2">FINDINGS · {active}</p>
            {findings.length === 0 && <p className="text-sm text-ink-2">No findings recorded for this room yet.</p>}
            {findings.map((f) => (
              <Card key={f.id} className={cx("rise flex items-start gap-3 p-3", !f.confirmed && "border-amber/50 bg-amber-2/50")}>
                <span className="stamp mt-0.5 rounded bg-paper-2 px-1.5 py-0.5">{f.id}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{f.observation}</p>
                  <p className="stamp mt-1 text-ink-2">
                    {f.readings.map((r) => `${r.kind}: ${r.result}`).join(" · ") || "visual"} · evidence {f.evidence_photo_ids.join(", ")} ·{" "}
                    {f.source === "ai_structured" ? "AI-structured" : "inspector-entered"}
                  </p>
                </div>
                {!f.confirmed && (
                  <Button className="min-h-9 text-xs" onClick={() => run("confirm", () => api.patch<CaseOut>(`/cases/${caseId}/findings/${f.id}`, { confirmed: true }))}>
                    <Check size={14} />Confirm
                  </Button>
                )}
                {f.source === "ai_structured" && (
                  <Button variant="ghost" className="min-h-9 px-2" onClick={() => run("del", () => api.del<CaseOut>(`/cases/${caseId}/findings/${f.id}`))}><Trash2 size={14} /></Button>
                )}
              </Card>
            ))}
          </div>
          {err && <p className="rounded-xl bg-rust-2 p-3 text-sm text-rust">{err}</p>}
        </section>
      </div>
    </StaffShell>
  );
}
