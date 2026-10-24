import { expect, test, type Page } from "@playwright/test";
import { installFakeConversation } from "./fake-conversation";

type Log = { events: string[]; results: { name: string; r: Record<string, unknown> }[]; spoken: { role: string; text: string }[] };

async function newCase(page: Page): Promise<string> {
  const r = await page.request.post("/api/cases", { data: { language: "en" } });
  return (await r.json()).case.id;
}

/** The API has no ElevenLabs key in e2e: answer /live/start like the real endpoint, with the real checklist. */
async function mockLiveStart(page: Page, failWith?: string) {
  await page.route("**/api/cases/*/live/start", async (route) => {
    if (failWith) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: failWith }) });
    const cl = await route.fetch({ url: route.request().url().replace("/live/start", "/live/checklist"), method: "GET" });
    await route.fulfill({ json: { signed_url: "wss://e2e.invalid", max_photos: 6, max_seconds: 300, checklist: await cl.json() } });
  });
}

async function startCall(page: Page, script: string, opts: { failWith?: string } = {}) {
  await page.addInitScript(installFakeConversation);
  await page.addInitScript((s) => { (window as unknown as Record<string, string>).__E2E_SCRIPT__ = s; }, script);
  await mockLiveStart(page, opts.failWith);
  const id = await newCase(page);
  await page.goto(`/assess/${id}/live`);
  await page.getByRole("button", { name: "Start live call" }).click();
  return id;
}

const log = (page: Page) => page.evaluate(() => (window as unknown as { __E2E_LOG__: Log }).__E2E_LOG__);

test("full call: real walkthrough camera, tools end to end, lands on the pre-assessment", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Download the React DevTools/.test(m.text())) errors.push(m.text()); });
  const endBody = page.waitForRequest((r) => r.url().endsWith("/live/end") && r.method() === "POST");
  const id = await startCall(page, "full");

  const video = page.getByLabel("Live camera view");
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBeGreaterThan(0);

  const transcript = (await endBody).postDataJSON().transcript as { role: string; text: string }[];
  await page.waitForURL(new RegExp(`/assess/${id}$`), { timeout: 60_000 });
  await expect(page.getByText("Your pre-assessment").first()).toBeVisible({ timeout: 30_000 });

  // Tools ran in order, answers were understood from plain speech, photos were captured.
  const l = await log(page);
  const order = l.results.map((x) => x.name);
  expect(order[0]).toBe("get_checklist");
  expect(order.at(-1)).toBe("finish_assessment");
  const saves = l.results.filter((x) => x.name === "save_answer");
  expect(saves.every((s) => s.r.ok === true)).toBe(true);
  const caps = l.results.filter((x) => x.name === "capture_photo");
  const captured = caps.filter((c) => c.r.captured);
  expect(captured.length).toBeGreaterThanOrEqual(3);
  test.info().annotations.push({ type: "captures", description: `${captured.length} captured / ${caps.length} attempts (${caps.filter((c) => c.r.problem === "moving").length} rejected as moving, ${caps.filter((c) => c.r.problem === "too_dark").length} too dark)` });

  // Transcript sent to /live/end has the same lines, in the same order, as spoken.
  expect(transcript.map((t) => t.text)).toEqual(l.spoken.map((s) => s.text));
  expect(transcript.map((t) => t.role)).toEqual(l.spoken.map((s) => (s.role === "agent" ? "ai" : "customer")));

  // Captured frames are real pictures, not black.
  const c = (await (await page.request.get(`/api/cases/${id}`)).json()).case;
  const photos = c.photos.filter((p: { source: string }) => p.source === "customer");
  expect(photos.length).toBe(captured.length);
  for (const p of photos) {
    const luma = await page.evaluate(async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const cv = Object.assign(document.createElement("canvas"), { width: 32, height: 32 });
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      return s / (d.length / 4);
    }, `/api/photos/${id}/${p.id}`);
    expect(luma).toBeGreaterThan(40);
  }
  expect(c.answers).toMatchObject({ room: "Laundry", occupant: "Owner", symptoms: "No", odor: "Not sure", leak: "No", location: "K1A 0B1" });
  expect(errors).toEqual([]);
});

test("camera denied -> friendly fallback to the upload flow", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });
  await startCall(page, "full");
  await expect(page.locator("p[role=alert]")).toContainText("couldn't open your camera");
  await expect(page.getByRole("link", { name: "Continue with photos and taps" })).toBeVisible();
});

test("quota_exceeded -> 'temporarily unavailable', upload flow offered", async ({ page }) => {
  await startCall(page, "full", { failWith: "ElevenLabs refused to start a call (401): quota_exceeded" });
  await expect(page.locator("p[role=alert]")).toContainText("temporarily unavailable");
  await expect(page.getByRole("link", { name: "Continue with photos and taps" })).toBeVisible();
});

test("dropped call -> error screen with a way forward", async ({ page }) => {
  await startCall(page, "drop");
  await expect(page.locator("p[role=alert]")).toContainText("The call dropped");
  await expect(page.getByRole("link", { name: "Continue with photos and taps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try the live call again" })).toBeVisible();
});

test("zero photos -> call ends cleanly into the upload flow", async ({ page }) => {
  const id = await startCall(page, "zero");
  await page.waitForURL(new RegExp(`/assess/${id}$`), { timeout: 30_000 });
  await expect(page.getByText(/wide photo/i)).toBeVisible({ timeout: 20_000 });
});

test("phone details: 44px targets, flashlight hidden when unsupported, wake lock or fallback, captions at 200% text", async ({ page }) => {
  await startCall(page, "full");
  await expect(page.getByText(/Listening|Bruce is talking/)).toBeVisible();
  for (const name of ["Mute microphone", "Type instead", "Take a photo"]) {
    const box = await page.getByRole("button", { name }).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("button", { name: /flashlight/i })).toHaveCount(0); // fake camera has no torch
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.wakeLock ?? "none")).toMatch(/on|video-fallback/);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const caption = page.locator("[aria-live=polite] p").first();
  await expect(caption).toBeVisible();
  const vw = page.viewportSize()!.width;
  const cb = await caption.boundingBox();
  expect(cb!.x).toBeGreaterThanOrEqual(0);
  expect(cb!.x + cb!.width).toBeLessThanOrEqual(vw + 1);
});
