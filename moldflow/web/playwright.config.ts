import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Live-mode e2e: the real sample walkthrough is the camera (Chromium fake device), ElevenLabs is mocked in the page,
 * and the API runs with MOLDFLOW_E2E_STUB=1 (canned AI outputs, zero model calls) on its own data dir.
 * Run: npm run test:e2e   (regenerates e2e/.media/walkthrough.y4m if needed)
 */
const Y4M = path.resolve(__dirname, "e2e/.media/walkthrough.y4m");
const chromiumCamera = {
  browserName: "chromium" as const,
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${Y4M}`],
  },
  permissions: ["camera", "microphone"],
};

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], ...chromiumCamera } },
    { name: "iphone-13", use: { ...devices["iPhone 13"], ...chromiumCamera } },
    { name: "pixel-7", use: { ...devices["Pixel 7"], ...chromiumCamera } },
  ],
  webServer: [
    {
      command: "uv run uvicorn app.main:app --port 8010",
      cwd: path.resolve(__dirname, "../api"),
      url: "http://127.0.0.1:8010/health",
      env: { MOLDFLOW_E2E_STUB: "1", MOLDFLOW_DATA_DIR: "/tmp/moldflow-e2e", OPENROUTER_API_KEY: "e2e-no-key", ELEVENLABS_API_KEY: "", ELEVENLABS_AGENT_ID: "" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npx next dev --port 3100",
      url: "http://127.0.0.1:3100",
      env: { MOLDFLOW_API: "http://127.0.0.1:8010", NEXT_DIST_DIR: ".next-e2e" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
