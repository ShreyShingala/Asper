"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Conversation, DisconnectionDetails } from "@elevenlabs/react";
import { Camera, Check, Flashlight, FlashlightOff, Keyboard, ListChecks, Mic, MicOff, PhoneOff, Send, Video } from "lucide-react";
import { api, type CaseOut, type Photo } from "@/lib/api";
import { DARK_LUMA, MOVING_DIFF, captureSteady, probe, setTorch, stats, torchSupported } from "@/lib/camera";
import { Button, Card, Eyebrow, Logo, Spinner, buttonClass, cx } from "@/components/ui";
import { MockConversation, speechRecognitionSupported, unlockSpeech } from "@/lib/mockVoice";
import { Precall, type PlanShot } from "./precall";
import { type Box, type BoxState, CapturePreview, CueWidget, FocusBox, ShotList, SweepGuide, boxFrom2d, defaultBox } from "./overlay";

type Checklist = {
  mode?: string; plan?: PlanShot[]; missing_shots: { shot: string; title?: string; instruction?: string }[]; shots_taken: string[];
  photos_left: number; ready_to_finish: boolean; can_finish_early: boolean;
  next_step?: { do: string; shot?: string; title?: string; coach?: string };
};
type Line = { role: "customer" | "ai"; text: string; at_ms: number };
type Phase = "intro" | "precall" | "connecting" | "live" | "after" | "finishing" | "error";
type Shot = { key: number; shot: string; preview: string; analyzing: boolean };
type Hint = "dark" | "moving" | null;
type Preview = { src: string; title: string; resolve: (keep: boolean) => void };

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
const AFTER_QUESTIONS = [
  { key: "occupant", text: "Last two quick questions. Are you the…", options: ["Owner", "Tenant", "Landlord / manager"] },
  { key: "symptoms", text: "Is anyone in the home having health symptoms?", options: ["Yes", "No", "Prefer not to say"] },
];
const SWEEP_MS = 6000;
const STEADY_TICKS = 3;  // ~1.8 s steady inside the box before auto-capture

function describe(p: Photo | undefined) {
  const a = p?.analysis;
  if (!a) return { analysis: "Saved, but the photo analysis is unavailable right now. Continue with the next shot." };
  return {
    photo_id: p!.id, quality: a.quality, observations: a.observations, visible_moisture: a.visible_moisture,
    areas_worth_a_closer_look: a.regions.map((r) => r.label), follow_up_question: a.follow_up_question,
  };
}

/** Three frames along the follow-the-arrow sweep, side by side in one image (one photo, analysed as a whole). */
async function captureSweep(video: HTMLVideoElement): Promise<Blob | null> {
  const scale = Math.min(1, 480 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  const w = Math.round((video.videoWidth || 0) * scale), h = Math.round((video.videoHeight || 0) * scale);
  if (!w) return null;
  const strip = document.createElement("canvas");
  strip.width = w * 3; strip.height = h;
  const ctx = strip.getContext("2d");
  if (!ctx) return null;
  const at = [500, SWEEP_MS / 2, SWEEP_MS - 400];  // ms into the sweep: left edge, middle, right edge
  for (let i = 0; i < at.length; i++) {
    await new Promise((r) => setTimeout(r, at[i] - (at[i - 1] ?? 0)));
    ctx.drawImage(video, i * w, 0, w, h);
  }
  return new Promise((r) => strip.toBlob(r, "image/jpeg", 0.85));
}

async function frameBlob(video: HTMLVideoElement, maxSide = 480): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  const c = document.createElement("canvas");
  c.width = Math.round((video.videoWidth || 0) * scale); c.height = Math.round((video.videoHeight || 0) * scale);
  if (!c.width) return null;
  c.getContext("2d")?.drawImage(video, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.75));
}

const DEMO_CLIP = "/demo/walkthrough-30s.mp4";
const DEMO_MODE = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";

const UNAVAILABLE = "Live mode is temporarily unavailable. Please upload photos instead; it only takes a few minutes.";
const friendly = (msg: string) => (/quota|credit|limit/i.test(msg) ? UNAVAILABLE : msg);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export default function Live() {
  const { caseId } = useParams<{ caseId: string }>();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"speaking" | "listening" | "thinking">("listening");
  const [voice, setVoice] = useState<"elevenlabs" | "mock" | null>(null);
  const [mockAvailable, setMockAvailable] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [plan, setPlan] = useState<PlanShot[]>([]);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [hint, setHint] = useState<Hint>(null);
  const [capturing, setCapturing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [boxState, setBoxState] = useState<BoxState>("aim");
  const [located, setLocated] = useState<{ shot: string; box: Box } | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [maxSeconds, setMaxSeconds] = useState(300);
  const [muted, setMuted] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [afterStep, setAfterStep] = useState(0);
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
  const currentRef = useRef<PlanShot | null>(null);
  const armedAtRef = useRef(0);
  const hasPhotosRef = useRef(false);

  const current = checklist?.next_step?.do === "capture" ? plan.find((s) => s.id === checklist.next_step?.shot) ?? null : null;
  useEffect(() => { currentRef.current = current; }, [current]);
  const box = located && current && located.shot === current.id ? located.box : defaultBox(current?.frame);

  const addLine = useCallback((role: Line["role"], raw: string) => {
    const text = raw.replace(/\[[a-z ]{2,24}\]\s*/gi, "").trim();
    if (!text) return;
    linesRef.current = [...linesRef.current, { role, text, at_ms: startedAtRef.current ? Date.now() - startedAtRef.current : 0 }];
    setLines(linesRef.current);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    videoRef.current?.pause();
  }, []);

  const applyChecklist = useCallback((cl: Checklist) => {
    photosLeftRef.current = cl.photos_left;
    if (cl.plan) setPlan(cl.plan);
    setChecklist(cl);
    return cl;
  }, []);

  const refreshChecklist = useCallback(async () => applyChecklist(await api.get<Checklist>(`/cases/${caseId}/live/checklist`)), [caseId, applyChecklist]);

  useEffect(() => {
    api.get<{ mock_available: boolean; voice: "elevenlabs" | "mock" }>("/live/config")
      .then((c) => { setMockAvailable(c.mock_available); setVoice((v) => v ?? c.voice); }).catch(() => {});
    api.get<Checklist>(`/cases/${caseId}/live/checklist`).then((cl) => { if (cl.mode === "photo_plan") applyChecklist(cl); }).catch(() => {});
  }, [caseId, applyChecklist]);

  const buildAssessment = useCallback(async () => {
    setPhase("finishing");
    setFinishStep(1);
    try {
      if (hasPhotosRef.current) await api.post(`/cases/${caseId}/pre-assessment`);
      router.replace(`/assess/${caseId}`);
    } catch (e) {
      setErr(`We saved your photos, but couldn't finish the pre-assessment: ${(e as Error).message}`);
      setPhase("error");
    }
  }, [caseId, router]);

  /** End the call, save the transcript, then the two remaining questions (owner/tenant, symptoms) before the pre-assessment. */
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
      hasPhotosRef.current = out.case.photos.some((p) => p.source === "customer" && p.analysis);
      const pending = AFTER_QUESTIONS.findIndex((q) => !out.case.answers[q.key]);
      if (pending >= 0) { setAfterStep(pending); setPhase("after"); } else await buildAssessment();
    } catch (e) {
      setErr(`We saved your call, but couldn't finish: ${(e as Error).message}`);
      setPhase("error");
    }
  }, [caseId, stopCamera, buildAssessment]);

  async function answerAfter(key: string, value: string) {
    await api.post(`/cases/${caseId}/answers`, { key, value }).catch(() => {});
    const next = AFTER_QUESTIONS.findIndex((q, i) => i > afterStep && q.key !== key);
    if (next >= 0) setAfterStep(next); else await buildAssessment();
  }

  /** Snap (or sweep), let the customer keep or retake, upload (runs the photo analysis) and report back. */
  const takeShot = useCallback(async (shot: string, by: "auto" | "ai" | "manual") => {
    const video = videoRef.current;
    if (shootingRef.current) return { captured: false, problem: "busy", tip: "A photo is already being taken." };
    if (photosLeftRef.current <= 0) return { captured: false, problem: "limit", tip: "No photos left. Finish the call." };
    if (!video) return { captured: false, problem: "no_video", tip: PROBLEM_TIP.no_video };
    const planShot = plan.find((s) => s.id === shot);
    shootingRef.current = true;
    setCapturing(true);
    setBoxState("snap");
    try {
      let blob: Blob | null = null;
      if (planShot?.kind === "sweep") {
        setSweepRunning(true);
        blob = await captureSweep(video);
        setSweepRunning(false);
        if (!blob) return { captured: false, problem: "no_video", tip: PROBLEM_TIP.no_video };
      } else {
        const cap = await captureSteady(video);
        if (!cap.ok) return { captured: false, problem: cap.problem, tip: PROBLEM_TIP[cap.problem] };
        blob = cap.blob;
      }
      const src = URL.createObjectURL(blob);
      setCapturing(false);
      const keep = await new Promise<boolean>((resolve) => setPreview({ src, title: planShot?.title ?? "Extra photo", resolve }));
      setPreview(null);
      armedAtRef.current = Date.now() + 2500;
      if (!keep) return { captured: false, problem: "retake", tip: "The customer chose to retake this shot. Coach it again briefly." };
      const key = ++shotKeyRef.current;
      setShots((s) => [...s, { key, shot, preview: src, analyzing: true }]);
      const fd = new FormData();
      fd.append("file", blob, `${shot}.jpg`);
      fd.append("prompt_id", shot);
      fd.append("source", "customer");
      const out = await api.upload<CaseOut>(`/cases/${caseId}/photos`, fd);
      const mine = out.case.photos.filter((p) => p.source === "customer");
      const photo = mine[mine.length - 1];
      setShots((s) => s.map((x) => (x.key === key ? { ...x, analyzing: false } : x)));
      const cl = await refreshChecklist();
      const result = { captured: true, shot, title: planShot?.title, ...describe(photo), checklist: cl };
      if (by !== "ai") {
        convRef.current?.sendContextualUpdate(`[photo] The customer kept "${planShot?.title ?? shot}" (${by === "auto" ? "auto-captured" : "shutter"}). `
          + `Result: ${JSON.stringify(describe(photo))}. Next step: ${JSON.stringify(cl.next_step)}`);
      }
      return result;
    } catch (e) {
      setShots((s) => s.map((x) => ({ ...x, analyzing: false })));
      return { captured: false, problem: "error", tip: `Saving the photo failed (${(e as Error).message}). Try once more or move on.` };
    } finally {
      shootingRef.current = false;
      setCapturing(false);
      setSweepRunning(false);
      setBoxState("aim");
    }
  }, [caseId, plan, refreshChecklist]);

  const onDisconnect = useCallback((d: DisconnectionDetails) => {
    if (finishingRef.current) return;
    if (d.reason === "agent") return void finish();
    if (d.reason === "error") {
      convRef.current = null;
      setErr(friendly(`The call dropped (${d.message || d.closeReason || "connection error"}).`));
      setPhase("error");
    }
  }, [finish]);

  async function start(force?: "mock") {
    unlockSpeech();  // must run inside the tap, before any await (iOS)
    const wanted = force ?? (new URLSearchParams(window.location.search).get("voice") === "mock" ? "mock" : undefined);
    finishingRef.current = false;
    setPhase("connecting");
    setErr(null);
    try {
      if (DEMO_MODE()) {
        // Demo mode: a real Mold Busters customer walkthrough (sample pack, 30 s) replays as the phone camera.
        const v = videoRef.current;
        if (v) {
          v.srcObject = null;
          v.src = DEMO_CLIP;
          v.loop = true;
          await v.play().catch(() => {});
        }
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setTorchOk(torchSupported(stream.getVideoTracks()[0]));
      }
    } catch {
      setErr(window.isSecureContext
        ? "We couldn't open your camera. Allow camera access in your browser, or upload photos instead."
        : "Live mode needs a secure (https) link to use your camera. Open the https link, or upload photos instead.");
      setPhase("error");
      return;
    }
    try {
      const s = await api.post<{ voice: "elevenlabs" | "mock"; signed_url: string | null; first_message: string; max_seconds: number; checklist: Checklist }>(
        `/cases/${caseId}/live/start`, wanted ? { voice: wanted } : {});
      setVoice(s.voice);
      applyChecklist(s.checklist);
      setMaxSeconds(s.max_seconds);
      armedAtRef.current = Date.now() + 4000;  // give the greeting a moment before the first auto-capture
      // Test seam: Playwright injects a scripted stand-in for the ElevenLabs session (window.__MOLDFLOW_FAKE_CONVERSATION__).
      const fake = (window as unknown as { __MOLDFLOW_FAKE_CONVERSATION__?: Pick<typeof import("@elevenlabs/react").Conversation, "startSession"> })
        .__MOLDFLOW_FAKE_CONVERSATION__;
      const clientTools = {
        get_checklist: async () => JSON.stringify(await refreshChecklist()),
        save_answer: async ({ key, value }: { key: string; value: string }) =>
          JSON.stringify(await api.post(`/cases/${caseId}/live/answer`, { key, value })),
        capture_photo: async ({ shot }: { shot: string }) => JSON.stringify(await takeShot(shot || currentRef.current?.id || "extra", "ai")),
        finish_assessment: () => { setTimeout(() => void finish(), 400); return "Ending the call."; },
      };
      const callbacks = {
        onConnect: ({ conversationId }: { conversationId: string }) => {
          convIdRef.current = conversationId;
          startedAtRef.current = Date.now();
          setPhase("live");
        },
        onError: (message: string) => {
          console.warn("live call error:", message);
          if (/microphone/i.test(message)) setTyping(true);
        },
        onMessage: ({ message, role }: { message: string; role: string }) => addLine(role === "agent" ? "ai" : "customer", message),
        onModeChange: ({ mode: m }: { mode: "speaking" | "listening" | "thinking" }) => setMode(m),
      };
      if (s.voice === "mock" && !fake) {
        if (!speechRecognitionSupported()) setTyping(true);
        const conv = await MockConversation.startSession({ caseId, firstMessage: s.first_message, clientTools, ...callbacks,
          onDisconnect: (d) => onDisconnect(d as DisconnectionDetails) });
        convRef.current = conv as unknown as Conversation;
      } else {
        const Conversation = fake ?? (await import("@elevenlabs/react")).Conversation;
        convRef.current = await Conversation.startSession({
          signedUrl: s.signed_url ?? "", connectionType: "websocket", clientTools, ...callbacks, onDisconnect,
          onModeChange: ({ mode: m }) => setMode(m),
        });
      }
    } catch (e) {
      stopCamera();
      const msg = (e as Error).message || "";
      setErr(/permission|notallowed|denied/i.test(msg)
        ? "We need your microphone to talk with you. Allow microphone access, or upload photos instead."
        : friendly(`We couldn't start the live call: ${msg || "please try again"}.`));
      setPhase("error");
    }
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

  // On-device coaching + auto-capture: brightness and motion a few times a second, no AI involved.
  useEffect(() => {
    if (phase !== "live") return;
    const canvas = document.createElement("canvas");
    let prev: Uint8ClampedArray | null = null;
    let dark = 0, moving = 0, steady = 0;
    const lastSent: Record<string, number> = {};
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video || shootingRef.current) { steady = 0; return; }
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
      const shot = currentRef.current;
      const calm = s.diff !== null && s.diff < MOVING_DIFF * 0.7 && s.luma >= DARK_LUMA;
      steady = shot && shot.kind !== "sweep" && calm && Date.now() > armedAtRef.current ? steady + 1 : 0;
      setBoxState(steady >= STEADY_TICKS - 1 ? "steady" : "aim");
      if (shot && steady >= STEADY_TICKS) {
        steady = 0;
        void takeShot(shot.id, "auto");
      }
    }, 600);
    return () => clearInterval(id);
  }, [phase, takeShot]);

  // Focus box: every few seconds ask the AI where the target is in the live frame; the box moves onto it.
  useEffect(() => {
    if (phase !== "live") return;
    let failures = 0, busy = false;
    const id = setInterval(async () => {
      const video = videoRef.current, shot = currentRef.current;
      if (!video || !shot || shot.kind === "sweep" || busy || shootingRef.current || failures >= 2) return;
      const blob = await frameBlob(video);
      if (!blob) return;
      busy = true;
      try {
        const fd = new FormData();
        fd.append("file", blob, "frame.jpg");
        fd.append("target", shot.target);
        const r = await api.upload<{ found: boolean; box_2d?: [number, number, number, number] }>(`/cases/${caseId}/live/locate`, fd);
        failures = 0;
        if (currentRef.current?.id === shot.id) setLocated(r.found && r.box_2d ? { shot: shot.id, box: boxFrom2d(r.box_2d) } : null);
      } catch {
        failures += 1;  // free model busy or rate-limited: keep the plan's guide box
      } finally {
        busy = false;
      }
    }, 8000);
    return () => clearInterval(id);
  }, [phase, caseId]);

  // Keep the screen on during the call (Wake Lock where supported; the playing camera <video> is the fallback).
  useEffect(() => {
    if (phase !== "live") return;
    type WakeLockSentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> } };
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState === "visible" && nav.wakeLock) {
        nav.wakeLock.request("screen").then((l) => { lock = l; document.documentElement.dataset.wakeLock = "on"; }).catch(() => {});
      } else if (!nav.wakeLock) {
        document.documentElement.dataset.wakeLock = "video-fallback";
      }
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
      delete document.documentElement.dataset.wakeLock;
    };
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
  const inCall = phase === "connecting" || phase === "live";
  const taken = checklist?.shots_taken ?? [];
  const status = phase === "connecting" ? "Connecting…" : mode === "thinking" ? "Bruce is thinking…" : mode === "speaking" ? "Bruce is talking"
    : typing && voice === "mock" && !speechRecognitionSupported() ? "Your turn: type below" : "Listening";

  return (
    <>
      <video ref={videoRef} playsInline muted autoPlay aria-label="Live camera view"
        className={cx("fixed inset-0 h-dvh w-full bg-kit-navy object-cover", !inCall && "hidden")} />

      {phase === "intro" && (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-5">
          <Logo small />
          <section className="rise mt-10">
            <Eyebrow color="text-brand" className="mb-3">Live with AI · about 4 minutes</Eyebrow>
            <h1 className="text-h5 font-bold tracking-tight text-ink">Bruce helps you take the right photos.</h1>
            <p className="mt-3 text-body font-light text-ink-body">Answer 5 quick taps, then Bruce guides your camera spot by spot so an inspector gets exactly what they need.</p>
          </section>
          <ul className="mt-6 space-y-3">
            {[
              [ListChecks, "5 taps first: where the problem is, how big, smell or leak, postal code. Your photo plan is built from them."],
              [Video, "Follow the orange box. Bruce says \"come closer\", \"tilt up\" or \"turn on a light\"."],
              [Camera, "Hold steady: the photo snaps by itself. Keep it or retake it."],
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
            <Button size="lg" fullWidth leading={<Video size={18} aria-hidden />} onClick={() => (plan.length ? void start() : setPhase("precall"))}>
              {plan.length ? "Start live call" : "Start"}
            </Button>
            <Link href={`/assess/${caseId}`} className={buttonClass({ variant: "outline", size: "lg", fullWidth: true })}>Upload photos instead</Link>
            <p className="text-center text-caption font-light text-ink-muted">
              English only. The call is transcribed and saved to your case so our team can review it.{" "}
              {voice === "mock" ? "Test voice: Bruce speaks with your browser's built-in voice and hears you with its speech recognition (best in Chrome or Edge); photos go to our AI provider."
                : "Voice is processed by ElevenLabs and photos by our AI provider."}
            </p>
          </div>
        </main>
      )}

      {phase === "precall" && <Precall caseId={caseId} onPlan={setPlan} onStart={() => void start()} />}

      {inCall && (
        <div className="fixed inset-0 flex h-dvh flex-col text-white">
          <header className="relative z-10 flex items-center gap-2 bg-gradient-to-b from-kit-navy/90 to-transparent px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
            <span className={cx("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-caption font-medium",
              phase === "connecting" || mode === "thinking" ? "bg-white/15" : mode === "speaking" ? "bg-brand" : "bg-kit-green")}>
              <span className={cx("h-2 w-2 rounded-full bg-white", phase === "live" && "animate-pulse")} />{status}
            </span>
            {voice === "mock" && phase === "live" && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium" title="Free test voice: your browser's speech, not ElevenLabs">Test voice</span>}
            {phase === "live" && <span className="text-caption tabular-nums text-white/80">{mmss(elapsed)} / {mmss(maxSeconds)}</span>}
            <Button variant="danger" size="sm" className="ml-auto" leading={<PhoneOff size={14} aria-hidden />} onClick={() => void finish()} disabled={phase !== "live"}>
              End
            </Button>
          </header>

          <div className="relative flex-1">
            {phase === "live" && current && current.kind !== "sweep" && !preview && <FocusBox box={box} state={boxState} label={current.title} />}
            {phase === "live" && current?.kind === "sweep" && !preview && (
              <SweepGuide running={sweepRunning} ms={SWEEP_MS} onStart={() => void takeShot(current.id, "manual")} />
            )}
            {plan.length > 0 && phase === "live" && <ShotList plan={plan} taken={taken} current={current?.id ?? null} open={listOpen} onToggle={() => setListOpen(!listOpen)} />}
            {hint && !preview && (
              <p role="status" className="absolute left-1/2 top-2 w-max max-w-[80vw] -translate-x-1/2 rounded-ds-xsm bg-kit-orange px-3 py-1.5 text-center text-subtitle font-medium shadow-ds-normal">
                {HINT_TEXT[hint]}
              </p>
            )}
            {preview && <CapturePreview src={preview.src} title={preview.title} autoKeepMs={2500} onKeep={() => preview.resolve(true)} onRetake={() => preview.resolve(false)} />}
            {checklist?.ready_to_finish && phase === "live" && !preview && (
              <div className="absolute inset-x-6 top-1/3 rounded-ds-sm bg-kit-navy/85 p-4 text-center">
                <p className="text-body font-semibold">All the photos are done.</p>
                <Button size="lg" className="mt-3" onClick={() => void finish()}>Finish</Button>
              </div>
            )}
          </div>

          <div className="space-y-3 bg-gradient-to-t from-kit-navy via-kit-navy/85 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
            <CueWidget cue={lastAi?.text} history={lines} thinking={mode === "thinking"} />

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
                <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="Type to Bruce…" aria-label="Type a message to Bruce"
                  className="h-12 min-w-0 flex-1 rounded-ds-sm border-[1.5px] border-white/20 bg-white/10 px-4 text-[16px] text-white outline-none placeholder:text-white/50 focus:border-white/60" />
                <Button type="submit" size="lg" disabled={!draft.trim()} aria-label="Send"><Send size={18} aria-hidden /></Button>
              </form>
            )}

            <div className="flex items-center justify-between">
              <RoundButton label={muted ? "Unmute microphone" : "Mute microphone"} onClick={toggleMute} active={muted} disabled={phase !== "live"}>
                {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
              </RoundButton>
              {torchOk ? (
                <RoundButton label={torchOn ? "Turn flashlight off" : "Turn flashlight on"} onClick={toggleTorch} active={torchOn}>
                  {torchOn ? <FlashlightOff size={20} aria-hidden /> : <Flashlight size={20} aria-hidden />}
                </RoundButton>
              ) : <span className="h-12 w-12" aria-hidden />}
              <button type="button" onClick={() => void takeShot(current?.id ?? "extra", "manual")}
                disabled={phase !== "live" || capturing || !!preview || (checklist?.photos_left ?? 1) <= 0}
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

      {phase === "after" && (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
          <Card className="rise p-6">
            <Eyebrow color="text-brand" className="mb-2">Photos done · {afterStep + 1} of {AFTER_QUESTIONS.length}</Eyebrow>
            <h1 className="text-h6 font-semibold text-ink">{AFTER_QUESTIONS[afterStep].text}</h1>
            <div className="mt-4 grid gap-2">
              {AFTER_QUESTIONS[afterStep].options.map((o) => (
                <Button key={o} size="lg" multiline variant="outline" onClick={() => void answerAfter(AFTER_QUESTIONS[afterStep].key, o)}>{o}</Button>
              ))}
            </div>
          </Card>
        </main>
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
              {mockAvailable && voice !== "mock" && <Button size="lg" onClick={() => void start("mock")}>Use the free test voice</Button>}
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
