/** On-device camera helpers for the live pre-assessment: cheap frame checks (no AI) and steady-frame capture. */

const PROBE_W = 64;
const PROBE_H = 48;
/** Mean luminance (0-255) below this reads as "too dark to see anything useful". */
export const DARK_LUMA = 42;
/** Mean absolute pixel change between two probes ~150-700 ms apart; above this the phone is moving. */
export const MOVING_DIFF = 22;

export type FrameStats = { luma: number; diff: number | null };

/** Draws the current video frame into a tiny canvas and returns its grayscale pixels. */
export function probe(video: HTMLVideoElement, canvas: HTMLCanvasElement): Uint8ClampedArray | null {
  if (!video.videoWidth) return null;
  canvas.width = PROBE_W;
  canvas.height = PROBE_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, PROBE_W, PROBE_H);
  const rgba = ctx.getImageData(0, 0, PROBE_W, PROBE_H).data;
  const gray = new Uint8ClampedArray(PROBE_W * PROBE_H);
  for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 299 + rgba[i * 4 + 1] * 587 + rgba[i * 4 + 2] * 114) / 1000;
  return gray;
}

export function stats(gray: Uint8ClampedArray, prev: Uint8ClampedArray | null): FrameStats {
  let sum = 0;
  let diff = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    if (prev) diff += Math.abs(gray[i] - prev[i]);
  }
  return { luma: sum / gray.length, diff: prev ? diff / gray.length : null };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Capture = { ok: true; blob: Blob; luma: number } | { ok: false; problem: "too_dark" | "moving" | "no_video" };

/** Samples a few frames and keeps the steadiest one, so screenshots aren't motion-blurred. */
export async function captureSteady(video: HTMLVideoElement, maxSide = 1280): Promise<Capture> {
  const probeCanvas = document.createElement("canvas");
  const full = document.createElement("canvas");
  let prev: Uint8ClampedArray | null = null;
  let best: { diff: number; luma: number; data: ImageData | null } = { diff: Infinity, luma: 0, data: null };
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  full.width = Math.round((video.videoWidth || 0) * scale);
  full.height = Math.round((video.videoHeight || 0) * scale);
  const fctx = full.getContext("2d");
  if (!fctx || !full.width) return { ok: false, problem: "no_video" };
  for (let i = 0; i < 6; i++) {
    const gray = probe(video, probeCanvas);
    if (gray) {
      const s = stats(gray, prev);
      if (s.diff !== null && s.diff < best.diff) {
        fctx.drawImage(video, 0, 0, full.width, full.height);
        best = { diff: s.diff, luma: s.luma, data: fctx.getImageData(0, 0, full.width, full.height) };
      }
      prev = gray;
    }
    await sleep(140);
  }
  if (!best.data) return { ok: false, problem: "no_video" };
  if (best.luma < DARK_LUMA) return { ok: false, problem: "too_dark" };
  if (best.diff > MOVING_DIFF + 6) return { ok: false, problem: "moving" };
  fctx.putImageData(best.data, 0, 0);
  const blob = await new Promise<Blob | null>((r) => full.toBlob(r, "image/jpeg", 0.88));
  return blob ? { ok: true, blob, luma: best.luma } : { ok: false, problem: "no_video" };
}

type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };

export function torchSupported(track: MediaStreamTrack | undefined): boolean {
  return !!(track && typeof track.getCapabilities === "function" && (track.getCapabilities() as TorchCapabilities).torch);
}

export async function setTorch(track: MediaStreamTrack, on: boolean): Promise<void> {
  await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}
