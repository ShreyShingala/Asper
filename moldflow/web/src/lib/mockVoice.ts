/**
 * Free test voice for live mode, used when ElevenLabs isn't available (no credits, no key).
 *
 * Same surface as the ElevenLabs session the live page uses (startSession / sendUserMessage / sendContextualUpdate /
 * setMicMuted / endSession) and the same client tools, so the page code doesn't change. The difference:
 * - Bruce's brain: POST /cases/{id}/live/mock/turn runs his real prompt on the free OpenRouter model.
 * - Bruce's voice: the browser's built-in speech synthesis (free, works offline on most devices).
 * - Hearing the customer: the browser's built-in speech recognition where available (Chrome, Edge, Safari);
 *   otherwise the customer types.
 * No barge-in: the customer is heard only while Bruce is listening.
 */
import { api } from "@/lib/api";

type Mode = "speaking" | "listening" | "thinking";
type Tools = Record<string, (args: never) => unknown>;  // any handler shape, like the ElevenLabs SDK
type Turn = { say: string; tools: { name: string; args: Record<string, unknown> }[] };
type HistoryItem = Record<string, unknown>;

export type MockOptions = {
  caseId: string;
  firstMessage: string;
  clientTools: Tools;
  onConnect?: (p: { conversationId: string }) => void;
  onDisconnect?: (d: { reason: "error"; message: string; context: { type: string } } | { reason: "user" } | { reason: "agent" }) => void;
  onError?: (message: string) => void;
  onMessage?: (p: { message: string; role: "agent" | "user" }) => void;
  onModeChange?: (p: { mode: Mode }) => void;
};

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechRecognitionSupported = () => recognitionCtor() !== null;
export const speechSynthesisSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Call synchronously inside the tap that starts the call: iOS only allows speech that a user gesture unlocked. */
export function unlockSpeech() {
  if (!speechSynthesisSupported()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const prefer = [/natural/i, /google us english/i, /samantha/i, /aria|jenny|guy/i, /en-(ca|us)/i];
  for (const rx of prefer) {
    const v = voices.find((x) => rx.test(x.name) || rx.test(x.lang));
    if (v) return v;
  }
  return voices[0];
}

async function voicesReady(): Promise<void> {
  if (!speechSynthesisSupported() || window.speechSynthesis.getVoices().length) return;
  await new Promise<void>((resolve) => {
    const done = () => { window.speechSynthesis.removeEventListener("voiceschanged", done); resolve(); };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    setTimeout(done, 1200);
  });
}

export class MockConversation {
  private history: HistoryItem[] = [];
  private queue: string[] = [];
  private busy = false;
  private ended = false;
  private muted = false;
  private listening = false;
  private failures = 0;
  private rec: Recognition | null = null;
  private readonly id = `mock_${Date.now().toString(36)}`;

  private constructor(private o: MockOptions) {}

  static async startSession(o: MockOptions): Promise<MockConversation> {
    const c = new MockConversation(o);
    await voicesReady();
    o.onConnect?.({ conversationId: c.id });
    c.history.push({ bruce: o.firstMessage });
    o.onMessage?.({ message: o.firstMessage, role: "agent" });
    void c.run(() => c.speak(o.firstMessage));
    return c;
  }

  getId() { return this.id; }

  sendUserMessage(text: string) {
    if (this.ended || !text.trim()) return;
    this.stopListening();
    this.queue.push(text.trim());
    void this.drain();
  }

  sendContextualUpdate(text: string) {
    if (this.ended) return;
    this.history.push({ app: text });
    // A photo the customer took deserves a reaction now; camera hints are picked up on Bruce's next turn.
    if (text.startsWith("[photo]") && !this.busy) void this.run(() => this.step());
  }

  setMicMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopListening();
    else if (!this.busy) this.listen();
  }

  async endSession() {
    if (this.ended) return;
    this.ended = true;
    this.stopListening();
    if (speechSynthesisSupported()) window.speechSynthesis.cancel();
    this.o.onDisconnect?.({ reason: "user" });
  }

  // ---------------------------------------------------------------- conversation loop
  private async drain() {
    if (this.busy) return;
    while (this.queue.length && !this.ended) {
      const said = this.queue.shift()!;
      this.history.push({ customer: said });
      await this.run(() => this.step());
    }
  }

  private async run(fn: () => Promise<void>) {
    this.busy = true;
    try {
      await fn();
    } finally {
      this.busy = false;
      if (!this.ended) {
        if (this.queue.length) void this.drain();
        else this.listen();
      }
    }
  }

  /** Up to 5 model calls per customer message: speak, run tools, react to their results. */
  private async step() {
    for (let i = 0; i < 5 && !this.ended; i++) {
      this.mode("thinking");
      let turn: Turn;
      try {
        turn = await api.post<Turn>(`/cases/${this.o.caseId}/live/mock/turn`, { history: this.history.slice(-70) });
        this.failures = 0;
      } catch (e) {
        this.failures += 1;
        this.o.onError?.(`test voice turn failed: ${(e as Error).message}`);
        if (this.failures >= 3) {
          this.ended = true;
          this.stopListening();
          this.o.onDisconnect?.({ reason: "error", message: "Bruce couldn't respond (the free AI model is busy).", context: { type: "mock" } });
          return;
        }
        await this.speak("Sorry, I missed that. Could you say it again?");
        return;
      }
      if (turn.say) {
        this.history.push({ bruce: turn.say });
        this.o.onMessage?.({ message: turn.say, role: "agent" });
        await this.speak(turn.say);
      }
      if (!turn.tools.length) return;
      for (const call of turn.tools) {
        if (this.ended) return;
        const handler = this.o.clientTools[call.name];
        let result: unknown;
        try {
          result = handler ? await handler((call.args ?? {}) as never) : `Unknown tool ${call.name}`;
        } catch (e) {
          result = `Tool failed: ${(e as Error).message}`;
        }
        const text = typeof result === "string" ? result : JSON.stringify(result ?? "");
        this.history.push({ tool_call: call.name, args: call.args, result: text.slice(0, 1800) });
        if (call.name === "finish_assessment") {
          this.ended = true;  // the page ends the call and builds the pre-assessment
          this.stopListening();
          return;
        }
      }
    }
  }

  // ---------------------------------------------------------------- speech out
  private speak(text: string): Promise<void> {
    if (!text || this.ended || !speechSynthesisSupported()) return Promise.resolve();
    this.mode("speaking");
    return new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = pickVoice() ?? null;
      u.lang = u.voice?.lang ?? "en-US";
      u.rate = 1.02;
      // Chrome sometimes never fires onend: estimate the length and resolve anyway.
      const fallback = setTimeout(resolve, 1500 + text.split(/\s+/).length * 450);
      u.onend = u.onerror = () => { clearTimeout(fallback); resolve(); };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }

  // ---------------------------------------------------------------- speech in
  private listen() {
    if (this.ended || this.busy || this.muted) return;
    this.mode("listening");
    const Ctor = recognitionCtor();
    if (!Ctor || this.listening) return;
    const rec = new Ctor();
    rec.lang = "en-CA";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let heard = false;
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      const text = r?.[0]?.transcript?.trim();
      if (r?.isFinal && text) {
        heard = true;
        this.o.onMessage?.({ message: text, role: "user" });
        this.sendUserMessage(text);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        this.muted = true;
        this.o.onError?.("microphone unavailable for speech recognition: type your answers instead");
      }
    };
    rec.onend = () => {
      this.listening = false;
      this.rec = null;
      // Recognition stops after silence; keep listening while it's the customer's turn.
      if (!heard && !this.busy && !this.ended && !this.muted) setTimeout(() => this.listen(), 250);
    };
    try {
      rec.start();
      this.rec = rec;
      this.listening = true;
    } catch {
      this.listening = false;
    }
  }

  private stopListening() {
    this.listening = false;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onend = null;
      try { rec.abort(); } catch { /* already stopped */ }
    }
  }

  private mode(m: Mode) {
    this.o.onModeChange?.({ mode: m });
  }
}
