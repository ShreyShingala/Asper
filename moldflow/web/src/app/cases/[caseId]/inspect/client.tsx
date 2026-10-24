"use client";
import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Mic, Sparkles, Check, Trash2, Camera, ArrowRight } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { useCase } from "@/lib/useCase";
import { Walkthrough } from "./walkthrough";
import { AnnotatedPhoto, Button, Card, Eyebrow, IconButton, KitTextarea, ProvenancePill, SidebarMenu, Spinner, StaffShell, Tag, buttonClass } from "@/components/ui";

const KINDS: Record<string, { label: string; options: string[] }> = {
  moisture: { label: "Moisture meter", options: ["elevated", "normal", "not_recorded"] },
  temp_rh_dew: { label: "Humidity / dew point", options: ["elevated", "normal", "not_recorded"] },
  thermal: { label: "Thermal camera", options: ["anomaly", "none", "not_recorded"] },
  swab: { label: "Instant swab", options: ["positive", "negative", "not_recorded"] },
  ball_slope: { label: "Ball-slope test", options: ["failed", "passed", "not_recorded"] },
};

export default function Inspect() {
  const { caseId } = useParams<{ caseId: string }>();
  const { c, err, busy, run, reload } = useCase(caseId);
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
      actions={<Link href={`/cases/${caseId}/review`} className={buttonClass({ size: "sm" })}>Go to review <ArrowRight size={14} aria-hidden /></Link>}>
      <Walkthrough caseId={caseId} onDone={() => void reload()} />
      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <SidebarMenu activeId={active} onSelect={setRoom} className="self-start lg:sticky lg:top-28"
          sections={[{
            heading: "Rooms",
            items: rooms.map((r) => ({
              id: r, label: r,
              badge: `${c.findings.filter((f) => f.room === r).length}f · ${c.photos.filter((p) => p.room === r).length}p`,
            })),
          }]} />
        <section className="space-y-5">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <Eyebrow>Evidence photos · {active}</Eyebrow>
              <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const fd = new FormData(); fd.append("file", f); fd.append("source", "inspector"); fd.append("room", active);
                run("upload", () => api.upload<CaseOut>(`/cases/${caseId}/photos`, fd));
              }} />
              <Button variant="outline" size="sm" state={busy === "upload" ? "loading" : undefined} leading={<Camera size={14} aria-hidden />} onClick={() => file.current?.click()}>Add photo</Button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {photos.map((p) => (
                <div key={p.id} className="w-40 shrink-0">
                  <AnnotatedPhoto caseId={caseId} photo={p} showBoxes={false} className="aspect-[3/4]" />
                  <p className="mt-1.5 text-caption font-light text-ink-muted"><b className="font-semibold text-ink">{p.id}</b> {p.caption_from_pack}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <Eyebrow className="mb-4">Quick-tap readings</Eyebrow>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(KINDS).map(([kind, k]) => (
                <div key={kind}>
                  <p className="mb-2 text-subtitle font-medium text-ink">{k.label}</p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={k.label}>
                    {k.options.map((o) => {
                      const on = readingState(kind) === o;
                      return (
                        <Button key={o} size="sm" variant={on ? "primary" : "outline"} disabled={!!busy} aria-pressed={on}
                          onClick={() => run("reading", () => api.post<CaseOut>(`/cases/${caseId}/readings`, { room: active, kind, result: o }))}>
                          {o.replace("_", " ")}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <Eyebrow className="mb-3">Field note → structured findings</Eyebrow>
            <div className="relative">
              <KitTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} aria-label="Field note" className="pr-10"
                placeholder="Type or dictate (keyboard mic), e.g. 'Tub faucet leaking, moisture meter shows elevated moisture below the faucet.'" />
              <Mic size={18} className="pointer-events-none absolute right-3 top-3 text-ink-muted" aria-hidden />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button disabled={!note.trim() || (!!busy && busy !== "note")} state={busy === "note" ? "loading" : undefined} leading={<Sparkles size={16} aria-hidden />}
                onClick={() => run("note", () => api.post<CaseOut>(`/cases/${caseId}/findings/from-note`, { room: active, text: note }).then((o) => { setNote(""); return o; }))}>
                Structure with AI
              </Button>
              {busy === "note" && <Spinner label="Structuring the note…" />}
              {lastAi && busy !== "note" && <ProvenancePill tier={lastAi.tier} ms={lastAi.latency_ms} model={lastAi.model} />}
            </div>
          </Card>

          <div className="space-y-2">
            <Eyebrow>Findings · {active}</Eyebrow>
            {findings.length === 0 && <p className="text-subtitle font-light text-ink-muted">No findings recorded for this room yet.</p>}
            {findings.map((f) => (
              <Card key={f.id} tone={f.confirmed ? undefined : "warning"} className="rise flex items-start gap-3 p-4">
                <Tag soft className="mt-0.5 shrink-0">{f.id}</Tag>
                <div className="min-w-0 flex-1">
                  <p className="text-subtitle text-ink">{f.observation}</p>
                  <p className="mt-1 text-caption font-light text-ink-muted">
                    {f.readings.map((r) => `${r.kind}: ${r.result}`).join(" · ") || "visual"} · evidence {f.evidence_photo_ids.join(", ")} ·{" "}
                    {f.source === "ai_structured" ? "AI-structured" : "inspector-entered"}
                  </p>
                </div>
                {!f.confirmed && (
                  <Button size="sm" leading={<Check size={14} aria-hidden />} onClick={() => run("confirm", () => api.patch<CaseOut>(`/cases/${caseId}/findings/${f.id}`, { confirmed: true }))}>
                    Confirm
                  </Button>
                )}
                {f.source === "ai_structured" && (
                  <IconButton variant="text" size="sm" label="Delete finding" onClick={() => run("del", () => api.del<CaseOut>(`/cases/${caseId}/findings/${f.id}`))}><Trash2 size={14} aria-hidden /></IconButton>
                )}
              </Card>
            ))}
          </div>
          {err && <Card tone="danger" role="alert" className="p-3 text-subtitle text-kit-red">{err}</Card>}
        </section>
      </div>
    </StaffShell>
  );
}
