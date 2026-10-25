"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileDown, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button, cx } from "@/components/ui";

type Frame = { id: string; t: number; url: string; room: string; finding: string; said: string; regions: { box_2d: number[]; label: string }[]; checks: string[] };
type Result = { case_id: string; duration_s: number; frames: Frame[]; transcript: { start: number; text: string }[];
  findings: { id: string; room: string; text: string; photos: string[] }[]; fields: Record<string, string>; recommendations: string[] };

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** On-site review from a recorded walkthrough: upload the video; frames, transcript, findings and report fields appear as they're worked out. */
export function OnsiteVideo() {
  const [r, setR] = useState<Result | null>(null);
  const [shown, setShown] = useState(0);        // frames revealed so far
  const [phase, setPhase] = useState<"idle" | "upload" | "frames" | "fields" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function go(f: File) {
    setErr(null); setPhase("upload"); setR(null); setShown(0);
    const fd = new FormData();
    fd.append("video", f, f.name);
    try {
      const [out] = await Promise.all([api.upload<Result>("/onsite/video", fd), new Promise((res) => setTimeout(res, 1800))]);
      setR(out); setPhase("frames");
    } catch (e) { setErr((e as Error).message); setPhase("idle"); }
  }
  useEffect(() => {
    if (!r || phase !== "frames") return;
    if (shown >= r.frames.length) { const t = setTimeout(() => setPhase("fields"), 900); return () => clearTimeout(t); }
    const t = setTimeout(() => setShown((n) => n + 1), 1300);
    return () => clearTimeout(t);
  }, [r, phase, shown]);
  useEffect(() => {
    if (phase !== "fields") return;
    const t = setTimeout(() => setPhase("done"), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  const lastT = r && shown ? r.frames[shown - 1].t : 0;
  return (
    <div className="space-y-4">
      {phase === "idle" && (
        <div className="rounded-ds-sm border border-dashed border-brand/50 p-5 text-center">
          <p className="text-subtitle font-medium text-ink">Upload the walkthrough video from the visit</p>
          <p className="mt-1 text-[13px] text-ink-muted">The AI pulls the key frames, reads what was said, marks what it sees and fills out the report.</p>
          <input ref={file} type="file" accept="video/*" className="sr-only" aria-label="Walkthrough video" onChange={(e) => e.target.files?.[0] && void go(e.target.files[0])} />
          <Button className="mt-3" leading={<Upload size={16} aria-hidden />} onClick={() => file.current?.click()}>Upload video</Button>
          {err && <p role="alert" className="mt-3 text-[13px] text-kit-red">{err}</p>}
        </div>
      )}
      {phase === "upload" && <p className="animate-pulse rounded-ds-sm bg-brand-tint/60 p-4 text-subtitle text-ink">Uploading and reading the video…</p>}
      {r && phase !== "upload" && (
        <>
          <div className="flex items-center gap-3 text-[13px] text-ink-body">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-kit-gray-soft">
              <div className="h-full bg-brand transition-all duration-700" style={{ width: `${Math.round((phase === "frames" ? lastT / r.duration_s : 1) * 100)}%` }} />
            </div>
            <span className="tabular-nums">{phase === "frames" ? `Scanning ${mmss(lastT)} / ${mmss(r.duration_s)}` : "Video read"}</span>
          </div>
          <ol className="space-y-3">
            {r.frames.slice(0, shown).map((f) => (
              <li key={f.id} className="rise grid gap-3 rounded-ds-sm border border-[#efe6df] p-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <div className="relative overflow-hidden rounded-ds-xsm bg-kit-navy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Frame at ${mmss(f.t)}`} className="w-full" />
                  {f.regions.map((g, i) => (
                    <span key={i} className="absolute rounded-[3px] border-2 border-brand" aria-hidden
                      style={{ top: `${g.box_2d[0] / 10}%`, left: `${g.box_2d[1] / 10}%`, height: `${(g.box_2d[2] - g.box_2d[0]) / 10}%`, width: `${(g.box_2d[3] - g.box_2d[1]) / 10}%` }} />
                  ))}
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 text-[11px] text-white">{mmss(f.t)}</span>
                </div>
                <div className="min-w-0 text-[13px]">
                  <p className="font-semibold text-ink">{f.room} · {f.finding}</p>
                  {f.said && <p className="mt-1 italic text-ink-muted">&ldquo;{f.said}&rdquo;</p>}
                  {f.checks.length > 0 && <p className="mt-1 text-ink-body">{f.checks.join(" ")}</p>}
                </div>
              </li>
            ))}
          </ol>
          {(phase === "fields" || phase === "done") && (
            <div className="rise rounded-ds-sm border border-[#efe6df] p-4">
              <p className="mb-2 text-subtitle font-semibold text-ink">Report fields, filled from the video</p>
              <dl className="grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-[160px_minmax(0,1fr)]">
                {Object.entries(r.fields).map(([k, v]) => (<Fragment key={k}><dt className="text-ink-muted">{k}</dt><dd className="text-ink">{v}</dd></Fragment>))}
              </dl>
              <p className="mb-1 mt-3 text-[13px] font-semibold text-ink">Findings ({r.findings.length})</p>
              <ul className="space-y-1 text-[13px] text-ink-body">{r.findings.map((x) => <li key={x.id} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-kit-green" aria-hidden />{x.room}: {x.text} <span className="text-ink-muted">[{x.photos.join(", ")}]</span></li>)}</ul>
              <p className="mb-1 mt-3 text-[13px] font-semibold text-ink">Recommendations</p>
              <ul className="list-disc space-y-0.5 pl-5 text-[13px] text-ink-body">{r.recommendations.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          {phase === "done" && (
            <div className={cx("rise flex flex-wrap gap-2")}>
              <Link href={`/cases/${r.case_id}/review`}><Button>Review &amp; approve the report</Button></Link>
              <a href={`/api/cases/${r.case_id}/export/report.pdf`} target="_blank" rel="noreferrer"><Button variant="outline" leading={<FileDown size={16} aria-hidden />}>Report PDF</Button></a>
              <Button variant="text" onClick={() => { setPhase("idle"); setR(null); }}>Upload another</Button>
            </div>
          )}
          {phase === "frames" && <p className="text-[13px] text-ink-muted">Transcript: {r.transcript.filter((x) => x.start <= lastT).length} of {r.transcript.length} lines read…</p>}
        </>
      )}
    </div>
  );
}
