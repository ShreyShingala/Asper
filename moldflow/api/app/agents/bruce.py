"""Bruce, the live pre-assessment assistant: prompt, first message and tool contracts.

Single source of truth used by the real ElevenLabs agent (scripts/setup_elevenlabs_agent.py pushes it), the free test
voice (POST /cases/{id}/live/mock/turn runs it on the OpenRouter model) and the call simulator (scripts/simulate_call.py)."""
import json
import re

from pydantic import BaseModel, Field
from typing import Literal

from app import config
from app.agents.llm import GUARDRAILS
from app.engine.live import FREE_TEXT, SHOT_IDS
from app.engine.rules import CHIPS

QUESTION_KEYS = [c.key for c in CHIPS["en"]] + list(FREE_TEXT)
# Boost words that short answers and postal codes depend on (NOT verified against real audio yet).
ASR_KEYWORDS = ["postal code", "Mold Busters", "laundry", "washroom", "basement", "attic", "tenant", "landlord", "musty",
                "nope", "kinda", "not sure", "Ontario", "Quebec", "Ottawa", "Gatineau", "Montreal"]

PROMPT = f"""You are Bruce, Mold Busters' photo coach, on a live camera call with a homeowner or tenant.
The customer already answered the screening questions before the call. Your ONLY job now is to help them take the exact
photos on their personalized shot list, so an inspector can judge what it is, how big it is and where moisture comes from.
Do not ask screening questions (room, smell, leak, owner/tenant, symptoms, postal code). They are handled outside the call.

How the app works
- The screen shows an orange focus box and a short shot list (usually 2 photos per spot: the area around it, then the
  spot itself up close). The CUSTOMER taps the white shutter button when the box is framed; the photo is shown to keep or
  retake. The box turns green when the phone is steady. They can also skip a shot. Only call capture_photo if they ask you
  to take it for them.
- You only see the photos that get captured (their analysis comes back to you as text), never the live video.
- Messages starting with [step], [photo] or [camera] come from the app, not the customer. Act on them; never read them aloud.
  [step] = the next shot to coach. [photo] = a photo was just kept (with its analysis). [camera] = the view is too dark or shaky.

Coaching
- Call get_checklist right after your greeting. Coach shots in the order of next_step; each tool result has the updated list.
- Speak like a calm inspector whispering cues: at most two short sentences (about 20 words) per turn, one instruction at a time.
  Examples: "Step back a little so the whole wall fits.", "Pan slightly to the right.", "Come closer, about an arm's length.",
  "Tilt up to the ceiling above it.", "Turn on your flashlight and point it into the vent.", "Hold still and tap the shutter."
- After a [photo] arrives, mention one thing the analysis noticed in plain words (no diagnosis), then give the cue for the
  next shot. If its quality is too_dark or blurry, coach a retake of the same shot once (light, flashlight, hold still).
- If the customer says the shot is impossible (no access, can't open it), say that's fine and move to the next shot.
- If the customer asks something (cost, is it dangerous), answer in one sentence and continue: pricing comes with their
  pre-assessment; for health, "I can't give medical advice, so please check with a doctor."
- If the customer mentions something useful (how long it's been there, a recent leak), acknowledge it in a few words; it is
  recorded in the transcript for the inspector.
- Tell them where to point, then "tap the shutter when it looks good". Keep the call short: about two minutes.
- You have at most {config.LIVE_MAX_PHOTOS} photos.

Finishing
- When next_step says finish, or the customer wants to stop and can_finish_early is true, say one sentence that you have
  what the inspector needs, then call finish_assessment in that same turn.
- English only. Calm, warm, plain-spoken. Never write bracketed tags like [happy].

{GUARDRAILS}"""

# Recording/transcription disclosure (PIPEDA meaningful consent, Quebec Law 25 transparency). The hub only learns facts
# from transcripts whose opening line contains it (app/hub_links.py). Why: docs/04_decisions.md D16.
FIRST_MESSAGE = ("Hi, I'm Bruce, Mold Busters' AI photo coach. This call is recorded and transcribed to help us. Point your back "
                 "camera at the first spot, fit it in the orange box and tap the shutter.")


def client_tool(name: str, description: str, properties: dict | None = None, required: list[str] | None = None, **extra) -> dict:
    cfg = {"type": "client", "name": name, "description": description, "expects_response": True, **extra}
    if properties:
        cfg["parameters"] = {"type": "object", "properties": properties, "required": required or list(properties)}
    return cfg


TOOLS = [
    client_tool("get_checklist", "Get the personalized shot list: shots still needed (with instructions), photos left, whether you "
                "can finish, and next_step (the shot to coach now).", response_timeout_secs=10),
    client_tool("capture_photo", "Snap the current camera view for one shot on the list, save it and analyse it. Returns what the photo "
                "shows or why it could not be taken (too dark, moving), plus the updated checklist. Say 'hold still' first.",
                {"shot": {"type": "string", "description": "The shot id from the checklist (e.g. s1_close), or 'extra'"},
                 "reason": {"type": "string", "description": "Short note on what you are capturing"}},
                response_timeout_secs=60, pre_tool_speech="force"),
    client_tool("finish_assessment", "End the call once the shot list is done (or the customer wants to stop). Only call after "
                "telling the customer you have what the inspector needs.",
                {"reason": {"type": "string", "enum": ["complete", "customer_requested", "time_up"], "description": "Why the call is ending"}},
                expects_response=False, execution_mode="post_tool_speech"),
]


class ToolCall(BaseModel):
    name: Literal["get_checklist", "save_answer", "capture_photo", "finish_assessment"]
    args: dict = Field(default={}, description="Tool arguments, e.g. {'key':'room','value':'Laundry'} or {'shot':'wide','reason':'...'}")


class BruceTurn(BaseModel):
    say: str = Field(default="", description="Exactly what you say out loud now. Empty if you are only calling tools.")
    tools: list[ToolCall] = Field(default=[], description="Tool calls to run, in order, after speaking (like parallel tool calls); "
                                  "empty list to wait for the customer.")


def tool_catalogue() -> str:
    lines = []
    for t in TOOLS:
        params = {k: v.get("enum") or v.get("description") for k, v in (t.get("parameters") or {}).get("properties", {}).items()}
        lines.append(f"- {t['name']}({json.dumps(params)}): {t['description']}")
    return "\n".join(lines)


TURN_NOTE = ("\n\n(Turn format) You are not on a native voice platform: each turn, reply with JSON. 'say' = your spoken words, "
             "'tools' = the tool calls to run now (several allowed, e.g. two save_answer calls) or []. After tool results arrive "
             "you get another turn to react; reply with say='' and tools=[] if you have nothing new to add. Tools:\n" + tool_catalogue())


# ---------------------------------------------------------------- rule-based Bruce (no AI available)
_FINISH = re.compile(r"\b(stop|done|finish|finished|that'?s (it|all)|end (the )?call|wrap (it )?up|i'?m good)\b", re.I)
_SKIP = re.compile(r"\b(skip|can'?t|cannot|no access|don'?t have|not possible|next one)\b", re.I)
_COST = re.compile(r"\b(cost|price|how much|expensive|charge|fee)\b", re.I)
_HEALTH = re.compile(r"\b(danger\w*|safe|health|sick|asthma|cough\w*|allerg\w*|breath\w*|toxic|black mold)\b", re.I)
_HI = re.compile(r"^\W*(hi|hello|hey|bonjour)\b", re.I)
_OK = re.compile(r"\b(ok(ay)?|ready|yes|yep|yeah|sure|got it|done that|alright|there)\b", re.I)
_SAID_RECENTLY = 3


def _cue(cl: dict) -> tuple[str, list[ToolCall]]:
    nxt = cl.get("next_step") or {}
    if nxt.get("do") == "capture":
        return f"{nxt.get('coach') or 'Point at the spot.'} Tap the shutter when it looks good.", []
    return "That's everything the inspector needs. I'll put your pre-assessment together now.", [ToolCall(name="finish_assessment", args={"reason": "complete"})]


def rule_turn(history: list[dict], checklist: dict) -> BruceTurn:
    """Deterministic stand-in when the AI is unavailable (quota, outage): Bruce still hears the customer, answers the common
    questions, reacts to each photo and coaches the next shot from the checklist."""
    last = history[-1] if history else {}
    recent_bruce = [h["bruce"] for h in history[-6:] if "bruce" in h][-_SAID_RECENTLY:]
    cue, tools = _cue(checklist)
    if "tool_call" in last:
        say = "" if any(cue in b for b in recent_bruce) else cue
        return BruceTurn(say=say, tools=tools if say else [])
    if (app := last.get("app")) is not None:
        if app.startswith("[camera]"):
            return BruceTurn(say="It's a bit dark. Turn on a light or tap the flashlight." if "dark" in app else "Hold the phone steady for a second.")
        if app.startswith("[photo]"):
            m = re.search(r'"observations":\s*\["([^"]+)"', app)
            seen = (f"Got it, I can see {m[1][0].lower() + m[1][1:].rstrip('.')}." if m and not m[1].lower().startswith("photo saved")
                    else "Got it, that one's saved.")
            return BruceTurn(say=f"{seen} {cue}", tools=tools)
        return BruceTurn(say="")
    said = str(last.get("customer", ""))
    if _FINISH.search(said):
        if checklist.get("can_finish_early") or checklist.get("ready_to_finish"):
            return BruceTurn(say="No problem, I have what I need. I'll put your pre-assessment together now.",
                             tools=[ToolCall(name="finish_assessment", args={"reason": "customer_requested"})])
        return BruceTurn(say="Sure. Let's grab just one photo first so the inspector has something to look at. " + cue)
    if _SKIP.search(said):
        return BruceTurn(say="That's fine. Tap Skip on the screen and we'll move to the next one.")
    if _COST.search(said):
        return BruceTurn(say=f"Pricing comes with your pre-assessment right after this call. {cue}", tools=tools)
    if _HEALTH.search(said):
        return BruceTurn(say=f"I can't give medical advice, so please check with a doctor. {cue}", tools=tools)
    if _HI.search(said):
        return BruceTurn(say=f"Hi! {cue}", tools=tools)
    if _OK.search(said):
        return BruceTurn(say=f"Great. {cue}", tools=tools)
    return BruceTurn(say=f"Thanks, I've noted that for the inspector. {cue}", tools=tools)
