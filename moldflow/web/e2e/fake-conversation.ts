/**
 * Injected into the page before load: a scripted stand-in for the ElevenLabs Conversation that drives the same four client
 * tools Bruce uses (get_checklist, save_answer, capture_photo, finish_assessment) through the real UI code paths.
 * window.__E2E_SCRIPT__ picks the scenario; window.__E2E_LOG__ records what happened, in order.
 */
export function installFakeConversation() {
  type Opts = {
    clientTools: Record<string, (a: Record<string, unknown>) => Promise<string> | string>;
    onConnect?: (x: { conversationId: string }) => void;
    onMessage?: (x: { message: string; role: "agent" | "user" }) => void;
    onDisconnect?: (d: { reason: string; message?: string }) => void;
  };
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
        say("agent", "Hi, I'm Bruce from Mold Busters. Point your camera at the spot.");
        await tool("get_checklist");
        if (script === "zero") {
          say("user", "Actually I have to go.");
          say("agent", "No problem, I'll save what we have.");
          await tool("finish_assessment", { reason: "customer_requested" });
          return;
        }
        say("user", "There are dark spots on the vent in my laundry room.");
        await tool("save_answer", { key: "concern", value: "Dark spots on the vent in the laundry room" });
        const answers: [string, string][] = [["room", "the laundry room"], ["occupant", "I own it"], ["symptoms", "nope"],
          ["odor", "kinda"], ["leak", "not that I know of"], ["location", "K1A 0B1"]];
        const shots = ["wide", "close", "above", "nearby"];
        for (let i = 0; i < answers.length; i++) {
          const [k, v] = answers[i];
          say("agent", `Quick question about the ${k}?`);
          say("user", v);
          await tool("save_answer", { key: k, value: v });
          if (i % 2 === 1 && shots.length) {
            const shot = shots.shift()!;
            say("agent", "Hold still for me.");
            for (let attempt = 0; attempt < 4; attempt++) {
              const r = await tool("capture_photo", { shot });
              if (r.captured) break;
              await wait(700);
            }
          }
        }
        for (const shot of shots) {
          say("agent", "Hold still for me.");
          for (let attempt = 0; attempt < 4; attempt++) {
            const r = await tool("capture_photo", { shot });
            if (r.captured) break;
            await wait(700);
          }
        }
        say("agent", "Thanks, I'll put your pre-assessment together now.");
        await tool("finish_assessment", { reason: "complete" });
      }, 400);
      return conv;
    },
  };
}
