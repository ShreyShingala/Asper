/**
 * Injected into the page before load: a scripted stand-in for the ElevenLabs Conversation that drives the same four client
 * tools Bruce uses (get_checklist, save_answer, capture_photo, finish_assessment) through the real UI code paths.
 * It follows the photo plan the way Bruce does: capture whatever the checklist's next_step asks for.
 * window.__E2E_SCRIPT__ picks the scenario; window.__E2E_LOG__ records what happened, in order.
 */
export function installFakeConversation() {
  type Opts = {
    clientTools: Record<string, (a: Record<string, unknown>) => Promise<string> | string>;
    onConnect?: (x: { conversationId: string }) => void;
    onMessage?: (x: { message: string; role: "agent" | "user" }) => void;
    onDisconnect?: (d: { reason: string; message?: string }) => void;
  };
  type Checklist = { ready_to_finish?: boolean; photos_left?: number; next_step?: { do: string; shot?: string } };
  const w = window as unknown as Record<string, unknown>;
  const log: { events: string[]; results: { name: string; r: unknown }[]; spoken: { role: string; text: string }[] } = { events: [], results: [], spoken: [] };
  w.__E2E_LOG__ = log;
  w.__MOLDFLOW_FAKE_CONVERSATION__ = {
    async startSession(opts: Opts) {
      const conv = {
        endSession: async () => { log.events.push("end"); },
        sendContextualUpdate: (t: string) => { log.events.push("ctx:" + t.slice(0, 60)); },
        sendUserMessage: (t: string) => { log.events.push("typed:" + t); },
        setMicMuted: () => {},
      };
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const say = (role: "agent" | "user", text: string) => { log.spoken.push({ role, text }); opts.onMessage?.({ message: text, role }); };
      const tool = async (name: string, args: Record<string, unknown> = {}) => {
        const raw = await opts.clientTools[name](args);
        let r: unknown = raw;
        try { r = JSON.parse(String(raw)); } catch {}
        log.results.push({ name, r });
        log.events.push("tool:" + name);
        return r as Record<string, unknown>;
      };
      setTimeout(async () => {
        opts.onConnect?.({ conversationId: "e2e-mock" });
        const script = (w.__E2E_SCRIPT__ as string) || "full";
        if (script === "drop") {
          await wait(800);
          opts.onDisconnect?.({ reason: "error", message: "connection lost" });
          return;
        }
        say("agent", "Hi, I'm Bruce, Mold Busters' AI photo coach. This call is recorded and transcribed to help us.");
        let cl = (await tool("get_checklist")) as Checklist;
        if (script === "zero") {
          say("user", "Actually I have to go.");
          say("agent", "No problem, I'll save what we have.");
          await tool("finish_assessment", { reason: "customer_requested" });
          return;
        }
        say("user", "There are dark spots on the vent in my laundry room.");
        await tool("save_answer", { key: "concern", value: "Dark spots on the vent in the laundry room" });
        for (const [k, v] of [["occupant", "I own it"], ["symptoms", "nope"]]) {
          say("agent", `Quick question about the ${k}?`);
          say("user", v);
          await tool("save_answer", { key: k, value: v });
        }
        // Follow the photo plan: capture what next_step asks for (the camera may also auto-capture on its own).
        for (let i = 0, captured = 0; i < 10 && captured < 3; i++) {
          if (cl.ready_to_finish || (cl.photos_left ?? 1) <= 0) break;
          const shot = cl.next_step?.do === "capture" ? cl.next_step.shot : "extra";
          say("agent", "Hold still for me.");
          const r = await tool("capture_photo", { shot });
          if (r.captured) { captured++; cl = (r.checklist as Checklist) ?? cl; } else { await wait(700); cl = (await tool("get_checklist")) as Checklist; }
        }
        say("agent", "Thanks, I'll put your pre-assessment together now.");
        await tool("finish_assessment", { reason: "complete" });
      }, 400);
      return conv;
    },
  };
}
