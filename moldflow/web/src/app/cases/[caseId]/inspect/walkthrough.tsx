"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Circle, FileText, Square, Video } from "lucide-react";
import { api, type CaseOut } from "@/lib/api";
import { Button, Card, Eyebrow, KitTextarea } from "@/components/ui";

type Rec = { start(): void; stop(): void; abort(): void; continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null };

const ROOMS = ["Basement", "Bathroom", "Upstairs washrooms", "Laundry", "Kitchen", "Attic", "Bedroom", "Exterior", "General"];
const SAMPLE = "Starting in the basement. No thermal anomalies on the foundation walls and humidity is within the normal range. " +
  "Swab test under the sink came back positive. Moving to the upstairs washrooms. The tub faucet is leaking and the moisture meter shows " +
  "elevated moisture below the faucet. Ball slope test failed in the shower enclosure. Black spots along the silicone at the tub edge. " +
  "Now the attic. Insulation is heavily disturbed near the hatch, with visible discoloration on the roof sheathing.";

/** On-site review: record a spoken walkthrough (video + live transcript + a snapshot every 10 s); it fills out the report. */
export function Walkthrough({ caseId, onDone }: { caseId: string; onDone: (c: CaseOut) => void }) {
  const [room, setRoom] = useState("General");
  const [text, setText] = useState("");
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const speech = useRef<Rec | null>(null);
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  async function start() {
    setMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.start(1000);
      mediaRef.current = mr;
      const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
      const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
      if (Ctor) {
        const r = new Ctor();
        r.continuous = true; r.interimResults = false; r.lang = "en-CA";
        r.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) setText((t) => `${t} ${e.results[i][0].transcript.trim()}.`.trim());
        };
        r.onend = () => { if (mediaRef.current?.state === "recording") try { r.start(); } catch { /* restarting */ } };
        r.start();
        speech.current = r;
      } else setMsg("This browser can't transcribe live; type or paste your notes below while recording.");
      setRec(true);
    } catch {
      setMsg("Couldn't open the camera and microphone. You can still type or paste the walkthrough notes below.");
    }
  }

  // A snapshot every 10 s while recording becomes evidence for the findings in the current room.
  useEffect(() => {
    if (!rec) return;
    const id = setInterval(async () => {
      const v = videoRef.current;
      if (!v?.videoWidth) return;
      const c = Object.assign(document.createElement("canvas"), { width: Math.min(1280, v.videoWidth), height: Math.round(Math.min(1280, v.videoWidth) * v.videoHeight / v.videoWidth) });
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.85));
      if (!blob) return;
      const fd = new FormData();
      fd.append("file", blob, "walkthrough.jpg"); fd.append("source", "inspector"); fd.append("room", roomRef.current);
      void api.upload(`/cases/${caseId}/photos`, fd).catch(() => {});
    }, 10000);
    return () => clearInterval(id);
  }, [rec, caseId]);

  async function finish() {
    setBusy(true); setMsg(null);
    let video: Blob | null = null;
    const mr = mediaRef.current;
    if (mr && mr.state === "recording") {
      await new Promise<void>((res) => { mr.onstop = () => res(); mr.stop(); });
      video = new Blob(chunks.current, { type: "video/webm" });
    }
    speech.current?.abort();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRec(false);
    try {
      const fd = new FormData();
      fd.append("transcript", text); fd.append("room", room); fd.append("by", "Inspector");
      if (video && video.size) fd.append("video", video, "walkthrough.webm");
      const out = await api.upload<CaseOut>(`/cases/${caseId}/onsite/walkthrough`, fd);
      setMsg(`Done: ${out.case.findings.length} findings recorded and the report drafted. It's waiting for approval.`);
      setText("");
      onDone(out);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-tint text-brand"><Video size={18} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <Eyebrow color="text-brand">On-site review</Eyebrow>
          <h2 className="text-subheading font-semibold text-ink">Record your walkthrough: it fills out the report</h2>
          <p className="text-caption text-ink-muted">Talk as you go (&ldquo;moving to the attic…&rdquo;). Rooms, readings and findings are picked up from what you say; a snapshot is saved every 10 seconds as evidence.</p>
        </div>
        <label className="text-caption text-ink-muted">Starting room{" "}
          <select value={room} onChange={(e) => setRoom(e.target.value)} className="ml-1 h-10 rounded-ds-xsm border border-kit-gray-soft px-2 text-subtitle text-ink">
            {ROOMS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
        <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-ds-sm bg-kit-navy object-cover" aria-label="Walkthrough camera" />
        <div className="flex flex-col gap-2">
          <KitTextarea aria-label="Walkthrough transcript" rows={6} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="The live transcript appears here. You can also type or paste your notes." />
          <div className="flex flex-wrap gap-2">
            {!rec ? <Button leading={<Circle size={14} className="fill-current" aria-hidden />} onClick={() => void start()}>Start recording</Button>
              : <Button variant="danger" leading={<Square size={14} aria-hidden />} onClick={() => void finish()} state={busy ? "loading" : undefined}>Stop and fill the report</Button>}
            {!rec && <Button variant="outline" leading={<FileText size={14} aria-hidden />} disabled={text.trim().length < 10} state={busy ? "loading" : undefined}
              onClick={() => void finish()}>Fill the report from this text</Button>}
            {!rec && !text && <Button variant="text" onClick={() => setText(SAMPLE)}>Use a sample walkthrough</Button>}
          </div>
          {msg && <p role="status" className="text-caption text-ink-body">{msg} {msg.startsWith("Done") && <Link href={`/cases/${caseId}/review`} className="font-medium text-brand underline">Open the report</Link>}</p>}
        </div>
      </div>
    </Card>
  );
}
