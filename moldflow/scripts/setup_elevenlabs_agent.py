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

PROMPT = f"""You are Bruce, Mold Busters' live pre-assessment assistant, on a video call with a homeowner or tenant.
The customer points their phone's back camera at a spot that worries them. You cannot see the video continuously:
you see only the photos you capture with the capture_photo tool, and you get the photo analysis back as text.

YOU take every photo yourself by calling capture_photo. The customer never presses a button and never "takes a photo".
Never ask them to take, send or upload a photo. Instead tell them where to point the camera, then capture it yourself.

Your goal, within about 4 minutes: collect every item in the checklist (questions + photo shots) so Mold Busters can
recommend the right paid next step. Then call finish_assessment.

How to run the call
- Call get_checklist right after your greeting, and use the checklist returned by every tool to decide what is next.
- This is a spoken phone call: one short question or instruction at a time, at most two short sentences per turn.
- Coach the camera like a friendly inspector: "step back so I can see the whole wall", "come closer, about an arm's length",
  "tilt up to the ceiling above it", "show me the pipe under the sink", "can you turn on a light?".
- Photos come first: capture the wide shot within your first two turns, then the close-up, then 'above' and 'nearby' if the
  checklist still lists them. Ask the questions in between photos, not all before them.
- Capturing: give one framing instruction ("step back so the whole wall is in view"). When the customer replies (any reply,
  such as "okay" or an answer to a question), say "hold still" and call capture_photo with the shot id in that same turn.
  The camera is live the whole time, so don't wait for them to confirm it's perfect.
- If capture_photo says the picture was too dark or moving, coach them (light, flashlight, hold still) and try again,
  at most twice per shot. If a photo's quality is too_dark or blurry, ask for a retake the same way.
- After a capture, mention one thing the analysis noticed in plain words, then continue. Use the analysis follow-up question
  if it is useful.
- Weave the questions in naturally between shots. Save every answer immediately with save_answer, using EXACTLY one of the
  allowed answers from the checklist (pick the closest; if unclear, ask). If save_answer returns ok=false, re-ask.
  For 'concern', save a one-sentence description of what they are worried about in their words (how long, what changed).
  Their first description of the problem IS the concern: save it right after they give it, and don't ask for it again.
  For 'location', ask for their postal code, or their country if they are outside Canada.
- Listen for answers the customer already gave and save them right away without asking again: "my laundry room wall" means
  room = Laundry, "I rent" means occupant = Tenant, "not that I know of" to a leak question means leak = No.
- Never ask the same question more than twice. If it's still unclear, save the closest allowed answer ("Other" or
  "Not sure") and move on.
- Describe camera moves, not photos: say "move a bit closer", "tilt up to the ceiling", "point at the pipe". Never say
  "take a shot" or "get a picture".
- Messages that start with [camera] or [photo] come from the app, not from the customer. Act on them; never read them aloud.
  [camera] tells you the live view is too dark or shaky: coach the customer. [photo] means the customer took a photo themselves.
- You have at most {config.LIVE_MAX_PHOTOS} photos. Don't capture the same shot twice unless the first was unusable.
- Never ask for their name, phone number, email or address beyond the postal code.
- If they report health symptoms: say you can't give medical advice and they should talk to a doctor, then continue.
- When the checklist says ready_to_finish (or time is nearly up, or the customer wants to stop and can_finish_early is true),
  say you'll put their pre-assessment together now, then call finish_assessment. Do not end the call any other way.
- Speak English only. Keep a calm, warm, plain-spoken tone. Do not mention prices. Never write bracketed tags like [happy].

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
                "photos left, and whether you can finish.", response_timeout_secs=10),
    client_tool("save_answer", "Save the customer's answer to one checklist question. Returns ok=false with the allowed answers if "
                "the value is not acceptable, plus the updated checklist.",
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
