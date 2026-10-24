import type { components } from "./api-types";

export type S = components["schemas"];
export type Case = S["Case"];
export type Photo = S["Photo"];
export type Flag = S["Flag"];
export type Finding = S["Finding"];
export type IntakeTurn = S["IntakeTurn"];
export type CaseOut = { case: Case; turn?: IntakeTurn | null };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, { cache: "no-store", ...init });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new ApiError(r.status, msg);
  }
  return r.json() as Promise<T>;
}

export const api = {
  get: <T,>(p: string) => req<T>(p),
  post: <T,>(p: string, body?: unknown) =>
    req<T>(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }),
  patch: <T,>(p: string, body: unknown) =>
    req<T>(p, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  del: <T,>(p: string) => req<T>(p, { method: "DELETE" }),
  upload: <T,>(p: string, form: FormData) => req<T>(p, { method: "POST", body: form }),
};

export const photoUrl = (caseId: string, photoId: string) => `/api/photos/${caseId}/${photoId}`;

/** Resize to <=1280px JPEG in the browser: fixes HEIC, EXIF rotation and upload size. */
export async function resizeImage(file: File, maxSide = 1280): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.85));
}

export const money = (v?: string | number | null) =>
  v == null ? "—" : `$${Number(v).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
