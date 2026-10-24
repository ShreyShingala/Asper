"""Create or update the ElevenLabs agent that runs the live camera + voice pre-assessment ("Bruce").

Idempotent: tools are matched by name and the agent by ELEVENLABS_AGENT_ID (or by name), then patched in place.
The agent id is written back to api/.env.local. Re-run after editing the prompt or tools below.
Needs ELEVENLABS_API_KEY with ElevenAgents write + Voices read permissions.
Usage (from moldflow/api): uv run python ../scripts/setup_elevenlabs_agent.py"""
import re
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from app import config  # noqa: E402
from app.agents.llm import GUARDRAILS  # noqa: E402
from app.engine.live import FREE_TEXT, SHOT_IDS  # noqa: E402
from app.engine.rules import CHIPS  # noqa: E402

AGENT_NAME = "MoldFlow Live Pre-Assessment (Bruce)"
VOICE_ID = "SAz9YHcvj6GT2YYXdXww"  # "River - Relaxed, Neutral, Informative" (calm stock voice); swap here
LLM = "gemini-2.5-flash"
ENV_FILE = config.API_DIR / ".env.local"

QUESTION_KEYS = [c.key for c in CHIPS["en"]] + list(FREE_TEXT)
# Boost words that short answers and postal codes depend on (NOT verified against real audio yet).
ASR_KEYWORDS = ["postal code", "Mold Busters", "laundry", "washroom", "basement", "attic", "tenant", "landlord", "musty",
                "nope", "kinda", "not sure", "Ontario", "Quebec", "Ottawa", "Gatineau", "Montreal"]

PROMPT = f"""You are Bruce, Mold Busters' live pre-assessment assistant, on a video call with a homeowner or tenant.
The customer points their phone's back camera at a spot that worries them. You cannot see the video continuously:
you see only the photos you capture with the capture_photo tool, and you get the photo analysis back as text.

YOU take every photo yourself by calling capture_photo. The customer never presses a button and never "takes a photo".
Never ask them to take, send or upload a photo. Tell them where to point the camera, then capture it yourself.

Goal, within about 4 minutes: fill the checklist (questions + photo shots) so Mold Busters can recommend the right paid
next step, then call finish_assessment.

Saving answers (most important)
- The moment the customer says anything that answers a checklist question, call save_answer for it, one call per fact,
  BEFORE you move on. This includes things they volunteer without being asked: "my laundry room" means room = Laundry,
  "I rent" means occupant = Tenant, "not that I know of" to a leak question means leak = No, "kinda" means Not sure.
- Never say "noted" or "got it" about something you have not saved with save_answer in this turn.
- Their first description of the problem IS the concern: save it with save_answer (key concern) right away, in their own
  words, and never ask for it again.
- Use the allowed answers from the checklist (the server also understands plain speech like "nope" or "I own it").
  If save_answer returns ok=false, ask once more with the choices; if still unclear, save "Not sure" or "Other".
- Vague answers ("I don't know", "maybe", "kinda") to the smell or leak question: save "Not sure" right away and move on.
  Don't ask again.
- For location, ask for the postal code, or the country if they are outside Canada. Save it straight away, then read a
  postal code back once, letter by letter ("K, 1, A, 0, B, 1, right?"). Only re-save if they correct you.

Running the call
- Call get_checklist right after your greeting. Every tool result includes the updated checklist with next_step: follow
  next_step unless the customer just raised something that needs a reply. Don't ask about anything already in answered.
- This is a spoken call: at most two short sentences (about 25 words) per turn, one question or one camera instruction.
  No lists, no reading out item numbers.
- Coach the camera like a friendly inspector: "step back so I can see the whole wall", "come closer, about an arm's length",
  "tilt up to the ceiling above it", "show me the pipe under the sink", "can you turn on a light?".
- Capturing: give one framing instruction. As soon as the customer replies (any reply, such as "okay"), say "hold still"
  and call capture_photo with the shot id in that same turn. The camera is live the whole time.
- If capture_photo says too dark or moving, coach them (turn on a light, use the phone flashlight, hold still) and try
  again, at most twice per shot. Treat a photo with quality too_dark or blurry the same way.
- After a capture, mention one thing the analysis noticed in plain words (no diagnosis), then continue.
- Never ask the same question more than twice, counting rephrasings. If it's still unclear, save the closest allowed answer
  and move on.
- After a tool result, don't repeat anything you already said. If you just asked a question, stay silent and wait for the
  answer.
- Describe camera moves, not photos: "move a bit closer", "tilt up to the ceiling". Never say "take a photo", "take a
  picture" or "take a shot", and never ask them to send or upload anything.
- Messages that start with [camera] or [photo] come from the app, not from the customer. Act on them; never read them aloud.
  [camera] means the live view is too dark or shaky: coach the customer. [photo] means the customer took a photo themselves.
- You have at most {config.LIVE_MAX_PHOTOS} photos. Don't capture the same shot twice unless the first was unusable.
- Never ask for their name, phone number, email or street address.
- Health: if anyone has symptoms or they ask whether it's dangerous, say "I can't give medical advice, so please check
  with a doctor," then continue. Never say whether it is safe or harmful.
- Prices: if they ask about cost, say the team will include pricing with their pre-assessment, then continue. Never say
  a number.

Finishing
- When next_step says finish (ready_to_finish is true), or the customer wants to stop and can_finish_early is true, or
  time is nearly up: say one sentence that you'll put their pre-assessment together now, then call finish_assessment
  in that same turn. Never end the call any other way, and never keep chatting after the checklist is complete.
- Speak English only. Calm, warm, plain-spoken. Never write bracketed tags like [happy].

{GUARDRAILS}"""

FIRST_MESSAGE = ("Hi, I'm Bruce from Mold Busters. Point your phone's back camera at the spot that's worrying you, "
                 "and tell me a little about what's going on.")


def client_tool(name: str, description: str, properties: dict | None = None, required: list[str] | None = None, **extra) -> dict:
    cfg = {"type": "client", "name": name, "description": description, "expects_response": True, **extra}
    if properties:
        cfg["parameters"] = {"type": "object", "properties": properties, "required": required or list(properties)}
    return cfg


TOOLS = [
    client_tool("get_checklist", "Get what is still missing for this pre-assessment: questions (with allowed answers), photo shots, "
                "photos left, whether you can finish, and next_step (the suggested next action).", response_timeout_secs=10),
    client_tool("save_answer", "Save one fact the customer just told you (asked or volunteered), immediately, one call per fact. "
                "Plain speech is understood ('nope', 'I rent', 'the laundry room'). Returns ok=false with the allowed answers if it "
                "can't be matched, plus the updated checklist with next_step.",
                {"key": {"type": "string", "enum": QUESTION_KEYS, "description": "Which checklist question this answers"},
                 "value": {"type": "string", "description": "Exactly one allowed answer from the checklist, or free text for concern/location"}},
                response_timeout_secs=10),
    client_tool("capture_photo", "Take a photo from the customer's live camera, save it to their case and analyse it. Returns what the "
                "photo shows (observations, quality, areas worth a closer look) or why it could not be taken (too dark, moving), "
                "plus the updated checklist. Tell the customer to hold still before calling.",
                {"shot": {"type": "string", "enum": SHOT_IDS, "description": "Which checklist shot this is; 'extra' for anything else worth showing"},
                 "reason": {"type": "string", "description": "Short note on what you are trying to capture"}},
                response_timeout_secs=60, pre_tool_speech="force"),
    client_tool("finish_assessment", "End the call and build the customer's pre-assessment. Only call after telling the customer you're "
                "putting it together.",
                {"reason": {"type": "string", "enum": ["complete", "customer_requested", "time_up"], "description": "Why the call is ending"}},
                expects_response=False, execution_mode="post_tool_speech"),
]


def upsert_tools(http: httpx.Client) -> list[str]:
    r = http.get("/v1/convai/tools")
    r.raise_for_status()
    existing = {t["tool_config"]["name"]: t["id"] for t in r.json().get("tools", []) if t.get("tool_config", {}).get("name")}
    ids = []
    for cfg in TOOLS:
        if tid := existing.get(cfg["name"]):
            http.patch(f"/v1/convai/tools/{tid}", json={"tool_config": cfg}).raise_for_status()
            print(f"  updated tool {cfg['name']} ({tid})")
        else:
            tid = http.post("/v1/convai/tools", json={"tool_config": cfg}).raise_for_status().json()["id"]
            print(f"  created tool {cfg['name']} ({tid})")
        ids.append(tid)
    return ids


def find_agent(http: httpx.Client) -> str | None:
    if config.ELEVENLABS_AGENT_ID:
        return config.ELEVENLABS_AGENT_ID
    r = http.get("/v1/convai/agents", params={"search": AGENT_NAME, "page_size": 30})
    r.raise_for_status()
    return next((a["agent_id"] for a in r.json().get("agents", []) if a.get("name") == AGENT_NAME), None)


def save_agent_id(agent_id: str) -> None:
    text = ENV_FILE.read_text() if ENV_FILE.exists() else ""
    line = f"ELEVENLABS_AGENT_ID={agent_id}"
    text = re.sub(r"(?m)^ELEVENLABS_AGENT_ID=.*$", line, text) if "ELEVENLABS_AGENT_ID=" in text else text.rstrip("\n") + f"\n{line}\n"
    ENV_FILE.write_text(text)


def main() -> None:
    if not config.ELEVENLABS_API_KEY:
        sys.exit(f"ELEVENLABS_API_KEY is not set in {ENV_FILE}")
    with httpx.Client(base_url=config.ELEVENLABS_BASE_URL, headers={"xi-api-key": config.ELEVENLABS_API_KEY}, timeout=30) as http:
        print("Tools:")
        tool_ids = upsert_tools(http)
        body = {
            "name": AGENT_NAME,
            "tags": ["moldflow"],
            "conversation_config": {
                "agent": {
                    "first_message": FIRST_MESSAGE,
                    "language": "en",
                    "max_conversation_duration_message": "We're at the time limit, so I'll put your pre-assessment together now.",
                    "prompt": {"prompt": PROMPT, "llm": LLM, "temperature": 0.3, "tool_ids": tool_ids, "timezone": "America/Toronto"},
                },
                "tts": {"voice_id": VOICE_ID, "expressive_mode": False},
                "asr": {"keywords": ASR_KEYWORDS},
                "conversation": {"max_duration_seconds": config.LIVE_MAX_SECONDS},
            },
            "platform_settings": {"auth": {"enable_auth": True}},
        }
        agent_id = find_agent(http)
        if agent_id:
            r = http.patch(f"/v1/convai/agents/{agent_id}", json=body)
            if r.status_code == 404:
                agent_id = None
            else:
                r.raise_for_status()
                print(f"Updated agent {agent_id}")
        if not agent_id:
            agent_id = http.post("/v1/convai/agents/create", json=body).raise_for_status().json()["agent_id"]
            print(f"Created agent {agent_id}")
    save_agent_id(agent_id)
    print(f"Saved ELEVENLABS_AGENT_ID to {ENV_FILE}. Restart the API to pick it up.")


if __name__ == "__main__":
    try:
        main()
    except httpx.HTTPStatusError as e:
        sys.exit(f"ElevenLabs API error {e.response.status_code} on {e.request.method} {e.request.url.path}: {e.response.text[:600]}")
