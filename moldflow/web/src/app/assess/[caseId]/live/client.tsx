"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Conversation, DisconnectionDetails } from "@elevenlabs/react";
import { Camera, Check, Flashlight, FlashlightOff, Keyboard, Mic, MicOff, PhoneOff, ScanEye, Send, Video } from "lucide-react";
import { api, type CaseOut, type Photo } from "@/lib/api";
import { DARK_LUMA, MOVING_DIFF, captureSteady, probe, setTorch, stats, torchSupported } from "@/lib/camera";
import { Button, Card, Eyebrow, Logo, Spinner, buttonClass, cx } from "@/components/ui";

type Checklist = {
  missing_questions: { key: string }[]; missing_shots: { shot: string }[]; shots_taken: string[];
  photos_left: number; ready_to_finish: boolean; can_finish_early: boolean;
};
type Line = { role: "customer" | "ai"; text: string; at_ms: number };
type Phase = "intro" | "connecting" | "live" | "finishing" | "error";
type Shot = { key: number; shot: string; preview: string; analyzing: boolean };
type Hint = "dark" | "moving" | null;

const HINT_TEXT = { dark: "Too dark: turn on a light", moving: "Hold the phone steady" } as const;
const HINT_UPDATE = {
  dark: "[camera] The live view is too dark to see anything useful. Ask the customer to turn on a light or their phone flashlight.",
  moving: "[camera] The live view is shaky. Ask the customer to hold the phone still.",
} as const;
const PROBLEM_TIP = {
  too_dark: "Not captured: too dark. Ask them to turn on a light or use their phone flashlight, then try again.",
  moving: "Not captured: the phone was moving. Ask them to hold still for a second, then try again.",
  no_video: "Not captured: the camera isn't ready yet. Try again in a moment.",
} as const;

function describe(p: Photo | undefined) {
  const a = p?.analysis;
  if (!a) return { analysis: "Saved, but the photo analysis is unavailable right now. Continue with the next item." };
  return {
    photo_id: p!.id, quality: a.quality, observations: a.observations, visible_moisture: a.visible_moisture,
    areas_worth_a_closer_look: a.regions.map((r) => r.label), follow_up_question: a.follow_up_question,
  };
}

const UNAVAILABLE = "Live mode is temporarily unavailable. Please upload photos instead; it only takes a few minutes.";
const friendly = (msg: string) => (/quota|credit|limit/i.test(msg) ? UNAVAILABLE : msg);

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export default function Live() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"speaking" | "listening">("listening");
  const [lines, setLines] = useState<Line[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [hint, setHint] = useState<Hint>(null);
  const [capturing, setCapturing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(300);
  const [muted, setMuted] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [finishStep, setFinishStep] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const convRef = useRef<Conversation | null>(null);
  const convIdRef = useRef<string | null>(null);
  const linesRef = useRef<Line[]>([]);
  const startedAtRef = useRef(0);
  const finishingRef = useRef(false);
  const shootingRef = useRef(false);
  const photosLeftRef = useRef(6);
  const shotKeyRef = useRef(0);

  const addLine = useCallback((role: Line["role"], raw: string) => {
    const text = raw.replace(/\[[a-z ]{2,24}\]\s*/gi, "").trim();
    if (!text) return;
    const line = { role, text, at_ms: startedAtRef.current ? Date.now() - startedAtRef.current : 0 };
    linesRef.current = [...linesRef.current, line];
    setLines(linesRef.current);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const refreshChecklist = useCallback(async () => {
    const cl = await api.get<Checklist>(`/cases/${caseId}/live/checklist`);
    photosLeftRef.current = cl.photos_left;
    setChecklist(cl);
    return cl;
  }, [caseId]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setPhase("finishing");
    setFinishStep(0);
    const conv = convRef.current;
    convRef.current = null;
    await conv?.endSession().catch(() => {});
    stopCamera();
    try {
      const out = await api.post<CaseOut>(`/cases/${caseId}/live/end`, { conversation_id: convIdRef.current, transcript: linesRef.current });
      setFinishStep(1);
      if (out.case.photos.some((p) => p.source === "customer" && p.analysis)) await api.post(`/cases/${caseId}/pre-assessment`);
      router.replace(`/assess/${caseId}`);
    } catch (e) {
      setErr(`We saved your call, but couldn't finish the pre-assessment: ${(e as Error).message}`);
      setPhase("error");
    }
  }, [caseId, router, stopCamera]);

  /** Takes a steady screenshot, uploads it to the case (which runs the photo analysis) and reports back for the agent. */
  const takeShot = useCallback(async (shot: string) => {
    const video = videoRef.current;
    if (shootingRef.current) return { captured: false, problem: "busy", tip: "A photo is already being taken." };
    if (photosLeftRef.current <= 0) return { captured: false, problem: "limit", tip: "No photos left. Finish when the questions are done." };
    if (!video) return { captured: false, problem: "no_video", tip: PROBLEM_TIP.no_video };
    shootingRef.current = true;
    setCapturing(true);
    try {
      const cap = await captureSteady(video);
      if (!cap.ok) return { captured: false, problem: cap.problem, tip: PROBLEM_TIP[cap.problem] };
      const key = ++shotKeyRef.current;
      setShots((s) => [...s, { key, shot, preview: URL.createObjectURL(cap.blob), analyzing: true }]);
      const fd = new FormData();
      fd.append("file", cap.blob, "live.jpg");
      fd.append("prompt_id", shot);
      fd.append("source", "customer");
      const out = await api.upload<CaseOut>(`/cases/${caseId}/photos`, fd);
      const mine = out.case.photos.filter((p) => p.source === "customer");
      const photo = mine[mine.length - 1];
      setShots((s) => s.map((x) => (x.key === key ? { ...x, analyzing: false } : x)));
      const cl = await refreshChecklist();
      return { captured: true, shot, ...describe(photo), checklist: cl };
    } catch (e) {
      setShots((s) => s.map((x) => ({ ...x, analyzing: false })));
      return { captured: false, problem: "error", tip: `Saving the photo failed (${(e as Error).message}). Try once more or move on.` };
    } finally {
      shootingRef.current = false;
      setCapturing(false);
    }
  }, [caseId, refreshChecklist]);

  const onDisconnect = useCallback((d: DisconnectionDetails) => {
    if (finishingRef.current) return;
    if (d.reason === "agent") return void finish();
    if (d.reason === "error") {
      convRef.current = null;
      setErr(friendly(`The call dropped (${d.message || d.closeReason || "connection error"}).`));
      setPhase("error");
    }
  }, [finish]);

  async function start() {
    setPhase("connecting");
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setTorchOk(torchSupported(stream.getVideoTracks()[0]));
    } catch {
      setErr(window.isSecureContext
        ? "We couldn't open your camera. Allow camera access in your browser, or upload photos instead."
        : "Live mode needs a secure (https) link to use your camera. Open the https link, or upload photos instead.");
      setPhase("error");
      return;
    }
    try {
      const s = await api.post<{ signed_url: string; max_seconds: number; checklist: Checklist }>(`/cases/${caseId}/live/start`);
      setChecklist(s.checklist);
      photosLeftRef.current = s.checklist.photos_left;
      setMaxSeconds(s.max_seconds);
      const { Conversation } = await import("@elevenlabs/react");
      convRef.current = await Conversation.startSession({
        signedUrl: s.signed_url,
        connectionType: "websocket",
        clientTools: {
          get_checklist: async () => JSON.stringify(await refreshChecklist()),
          save_answer: async ({ key, value }: { key: string; value: string }) => {
            const r = await api.post<{ ok: boolean; checklist: Checklist }>(`/cases/${caseId}/live/answer`, { key, value });
            photosLeftRef.current = r.checklist.photos_left;
            setChecklist(r.checklist);
            return JSON.stringify(r);
          },
          capture_photo: async ({ shot }: { shot: string }) => JSON.stringify(await takeShot(shot)),
          finish_assessment: () => { setTimeout(() => void finish(), 400); return "Ending the call and building the pre-assessment."; },
        },
        onConnect: ({ conversationId }) => {
          convIdRef.current = conversationId;
          startedAtRef.current = Date.now();
          setPhase("live");
        },
        onDisconnect,
        onError: (message) => console.warn("live call error:", message),
        onMessage: ({ message, role }) => addLine(role === "agent" ? "ai" : "customer", message),
        onModeChange: ({ mode: m }) => setMode(m),
      });
    } catch (e) {
      stopCamera();
      const msg = (e as Error).message || "";
      setErr(/permission|notallowed|denied/i.test(msg)
        ? "We need your microphone to talk with you. Allow microphone access, or upload photos instead."
        : friendly(`We couldn't start the live call: ${msg || "please try again"}.`));
      setPhase("error");
    }
  }

  async function userShot() {
    const next = checklist?.missing_shots[0]?.shot ?? "extra";
    const r = await takeShot(next);
    if (r.captured) convRef.current?.sendContextualUpdate(`[photo] The customer took a photo themselves (shot: ${next}). Result: ${JSON.stringify(r)}`);
  }

  function sendTyped(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !convRef.current) return;
    convRef.current.sendUserMessage(draft.trim());
    addLine("customer", draft);
    setDraft("");
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    await setTorch(track, !torchOn).then(() => setTorchOn(!torchOn)).catch(() => setTorchOk(false));
  }

  function toggleMute() {
    convRef.current?.setMicMuted(!muted);
    setMuted(!muted);
  }

  // On-device coaching: brightness + motion checks a few times a second, no AI involved.
  useEffect(() => {
    if (phase !== "live") return;
    const canvas = document.createElement("canvas");
    let prev: Uint8ClampedArray | null = null;
    let dark = 0, moving = 0;
    const lastSent: Record<string, number> = {};
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video || shootingRef.current) return;
      const gray = probe(video, canvas);
      if (!gray) return;
      const s = stats(gray, prev);
      prev = gray;
      dark = s.luma < DARK_LUMA ? dark + 1 : 0;
      moving = s.diff !== null && s.diff > MOVING_DIFF ? moving + 1 : 0;
      const h: Hint = dark >= 3 ? "dark" : moving >= 4 ? "moving" : null;
      setHint(h);
      if (h && Date.now() - (lastSent[h] ?? 0) > 15000) {
        lastSent[h] = Date.now();
        convRef.current?.sendContextualUpdate(HINT_UPDATE[h]);
      }
    }, 600);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => {
    convRef.current?.endSession().catch(() => {});
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const lastAi = [...lines].reverse().find((l) => l.role === "ai");
  const lastCustomer = [...lines].reverse().find((l) => l.role === "customer");
  const inCall = phase === "connecting" || phase === "live";

  return (
    <>
      <video ref={videoRef} playsInline muted autoPlay aria-label="Live camera view"
        className={cx("fixed inset-0 h-dvh w-full bg-kit-navy object-cover", !inCall && "hidden")} />

      {phase === "intro" && (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-5">
          <Logo small />
          <section className="rise mt-10">
            <Eyebrow color="text-brand" className="mb-3">Live with AI · about 4 minutes</Eyebrow>
            <h1 className="text-h5 font-bold tracking-tight text-ink">Show us, and talk it through.</h1>
            <p className="mt-3 text-body font-light text-ink-body">Bruce, our AI assistant, guides you over a live camera call and takes the photos for you.</p>
          </section>
          <ul className="mt-6 space-y-3">
            {[
              [Video, "Point your back camera at the spot. Bruce will say \"come closer\", \"show the ceiling\" or \"turn on a light\"."],
              [Mic, "Answer a few quick questions out loud, or type if you prefer."],
              [Camera, "Bruce captures the key photos. You can also tap the shutter to show something."],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Video;
              return (
                <li key={i}>
                  <Card className="flex items-start gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-tint text-brand"><I size={18} aria-hidden /></span>
                    <span className="text-subtitle text-ink">{text as string}</span>
                  </Card>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto space-y-3 pt-8">
            <Button size="lg" fullWidth leading={<Video size={18} aria-hidden />} onClick={start}>Start live call</Button>
            <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "outline", size: "lg", fullWidth: true })}>Upload photos instead</Link>
            <p className="text-center text-caption font-light text-ink-muted">
              English only. The call is transcribed and saved to your case so our team can review it. Voice is processed by ElevenLabs and photos by our AI provider.
            </p>
          </div>
        </main>
      )}

      {inCall && (
        <div className="fixed inset-0 flex h-dvh flex-col text-white">
          <header className="flex items-center gap-2 bg-gradient-to-b from-kit-navy/90 to-transparent px-4 pb-6 pt-4">
            <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-caption font-medium",
              phase === "connecting" ? "bg-white/15" : mode === "speaking" ? "bg-brand" : "bg-kit-green")}>
              <span className={cx("h-2 w-2 rounded-full bg-white", phase === "live" && "animate-pulse")} />
              {phase === "connecting" ? "Connecting…" : mode === "speaking" ? "Bruce is talking" : "Listening"}
            </span>
            {phase === "live" && <span className="text-caption tabular-nums text-white/80">{mmss(elapsed)} / {mmss(maxSeconds)}</span>}
            <Button variant="danger" size="sm" className="ml-auto" leading={<PhoneOff size={14} aria-hidden />} onClick={() => void finish()} disabled={phase !== "live"}>
              End
            </Button>
          </header>

          <div className="relative flex-1">
            {hint && (
              <p role="status" className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-ds-xsm bg-kit-orange px-3 py-1.5 text-subtitle font-medium shadow-ds-normal">
                {HINT_TEXT[hint]}
              </p>
            )}
            {capturing && (
              <>
                <div className="pointer-events-none absolute inset-0 animate-pulse bg-white/10" />
                <p role="status" className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-ds-xsm bg-kit-navy/80 px-3 py-2 text-subtitle">
                  <ScanEye size={16} aria-hidden /> Taking a photo… hold still
                </p>
              </>
            )}
          </div>

          <div className="space-y-3 bg-gradient-to-t from-kit-navy via-kit-navy/85 to-transparent px-4 pb-5 pt-10">
            <div aria-live="polite" className="min-h-12 space-y-1">
              {lastAi && <p className="text-body font-medium leading-snug">{lastAi.text}</p>}
              {lastCustomer && <p className="text-subtitle text-white/70">You: {lastCustomer.text}</p>}
            </div>

            {shots.length > 0 && (
              <ul className="flex gap-2 overflow-x-auto" aria-label="Photos taken">
                {shots.map((s) => (
                  <li key={s.key} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-ds-xsm ring-1 ring-white/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.preview} alt={`${s.shot} photo`} className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-kit-navy/40">
                      {s.analyzing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Check size={16} aria-hidden />}
                    </span>
                  </li>
                ))}
                {checklist && <li className="self-center text-caption text-white/70">{checklist.photos_left} left</li>}
              </ul>
            )}

            {typing && (
              <form onSubmit={sendTyped} className="flex gap-2">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="Type your answer…" aria-label="Type a message to Bruce"
                  className="h-12 min-w-0 flex-1 rounded-ds-sm border-[1.5px] border-white/20 bg-white/10 px-4 text-[16px] text-white outline-none placeholder:text-white/50 focus:border-white/60" />
                <Button type="submit" size="lg" disabled={!draft.trim()} aria-label="Send"><Send size={18} aria-hidden /></Button>
              </form>
            )}

            <div className="flex items-center justify-between">
              <RoundButton label={muted ? "Unmute microphone" : "Mute microphone"} onClick={toggleMute} active={muted} disabled={phase !== "live"}>
                {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
              </RoundButton>
              <RoundButton label={torchOn ? "Turn flashlight off" : "Turn flashlight on"} onClick={toggleTorch} active={torchOn} disabled={!torchOk}>
                {torchOn ? <FlashlightOff size={20} aria-hidden /> : <Flashlight size={20} aria-hidden />}
              </RoundButton>
              <button type="button" onClick={userShot} disabled={phase !== "live" || capturing || (checklist?.photos_left ?? 1) <= 0}
                aria-label="Take a photo" title="Take a photo"
                className="grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-white/80 transition active:scale-95 disabled:opacity-40">
                <span className="h-12 w-12 rounded-full bg-white" />
              </button>
              <RoundButton label="Type instead" onClick={() => setTyping(!typing)} active={typing} disabled={phase !== "live"}>
                <Keyboard size={20} aria-hidden />
              </RoundButton>
              <span className="h-12 w-12" aria-hidden />
            </div>
          </div>
        </div>
      )}

      {phase === "finishing" && (
        <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
          <Card className="w-full p-6">
            <h1 className="text-h6 font-semibold text-ink">Thanks! Putting it together…</h1>
            <ul className="mt-4 space-y-2">
              {["Saving your call and photos", "Writing your pre-assessment"].map((s, i) => (
                <li key={s} className={cx("flex items-center gap-2 text-subtitle", i <= finishStep ? "text-ink" : "text-ink-muted/50")}>
                  {i < finishStep ? <Check size={16} className="text-kit-green" aria-hidden /> : i === finishStep ? <Spinner /> : <span className="w-4" />} {s}
                </li>
              ))}
            </ul>
          </Card>
        </main>
      )}

      {phase === "error" && (
        <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-5">
          <Card className="w-full space-y-4 p-6">
            <h1 className="text-h6 font-semibold text-ink">The live call isn&apos;t available</h1>
            <p role="alert" className="rounded-ds-sm bg-alert-danger-bg p-3 text-subtitle text-kit-red">{err}</p>
            <div className="grid gap-2">
              {checklist?.can_finish_early && <Button size="lg" onClick={() => { finishingRef.current = false; void finish(); }}>Finish with what we have</Button>}
              <Button size="lg" variant="outline" onClick={() => { finishingRef.current = false; setPhase("intro"); }}>Try the live call again</Button>
              <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "text", size: "lg" })}>Continue with photos and taps</Link>
            </div>
          </Card>
        </main>
      )}
    </>
  );
}

function RoundButton({ label, active, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={active} {...p}
      className={cx("grid h-12 w-12 place-items-center rounded-full transition disabled:opacity-30", active ? "bg-white text-kit-navy" : "bg-white/15 text-white hover:bg-white/25")}>
      {children}
    </button>
  );
}
