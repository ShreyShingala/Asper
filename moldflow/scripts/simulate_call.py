"""Simulated Bruce calls driven by the sample jobs, scored automatically -> api/proof/eval_calls.json (shown on /proof).

Backends
  --backend elevenlabs  the real agent over the ElevenLabs Agents WebSocket (signed URL from POST /cases/{id}/live/start).
                        Text turns via user_message; --audio streams ElevenLabs TTS of the customer's words as PCM 16 kHz
                        user_audio_chunk messages. Needs ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID. Costs credits.
  --backend local       stand-in: the SAME prompt, first message and tool contracts from setup_elevenlabs_agent.py, run on the
                        OpenRouter free model as structured JSON turns (Pydantic). Free, but a different LLM and no audio:
                        results are "not verified with a live call".
Both execute tools against the real MoldFlow API exactly like web/src/app/assess/[caseId]/live/client.tsx does.
The customer is rule-based by default (deterministic, zero model calls, answers only from the persona fact sheet);
--customer llm uses an OpenRouter model instead.

Usage (from moldflow/api, API running on :8000):
  uv run python ../scripts/simulate_call.py --persona job2-virtual          # one call (prove it first)
  uv run python ../scripts/simulate_call.py --persona all --label c0        # batch + scores"""
import argparse
import asyncio
import base64
import json
import re
import sys
import time
from datetime import datetime
from itertools import cycle
from pathlib import Path
from typing import Literal

import httpx
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "api"))
from app import config  # noqa: E402
from app.agents.llm import structured  # noqa: E402
from setup_elevenlabs_agent import FIRST_MESSAGE, PROMPT, TOOLS  # noqa: E402
from sim.personas import PERSONAS, Persona  # noqa: E402

OUT = config.API_DIR / "proof" / "eval_calls.json"
WORDS_PER_S = 2.6  # ~155 wpm speech
PROBLEM_TIP = {"too_dark": "Not captured: too dark. Ask them to turn on a light or use their phone flashlight, then try again.",
               "moving": "Not captured: the phone was moving. Ask them to hold still for a second, then try again."}

# ---------------------------------------------------------------- understanding Bruce's turns (for the customer + scoring)
ASK = {
    "room": r"\b(which|what) (room|part of|area)|where('s| is| in)? (it|this|that|your|the)\b|where in\b|what area|which area|is (it|this) in (the|a|your)",
    "occupant": r"\b(own|rent|renting|owner|tenant|landlord)\b",
    "symptoms": r"symptom|health|unwell|sick|cough|allerg|breathing|headache",
    "odor": r"smell|odou?r|musty",
    "leak": r"leak|water damage|drip|flood|water (issue|problem|coming)",
    "location": r"postal|zip code|country|which city|what city|where are you (located|based)",
    "concern": r"how long|what('s| is) (going on|worrying)|tell me (more|about)|describe|what (did|have) you (notice|see)",
}
CAMERA = r"step back|closer|tilt|point|show me|hold (it |the phone )?still|turn on|flashlight|\blight\b|aim|angle|pan |bring|move|lower|raise|look at|frame"


def asked(text: str) -> list[str]:
    """Question keys in the sentences that end with '?' only (acknowledgements like "noted the musty smell" don't count).
    A concern question ('how long...', 'tell me more') is answered on its own."""
    qs = " ".join(q.lower() for q in re.findall(r"[^.!?]*\?", text))
    keys = [k for k, rx in ASK.items() if re.search(rx, qs)]
    return ["concern"] if "concern" in keys else keys


class RuleCustomer:
    def __init__(self, p: Persona):
        self.p, self.turn, self.asked = p, 0, {k: 0 for k in ASK}
        self.lines = {k: cycle(v) for k, v in p.say.items()}
        self.quit_said = False

    def reply(self, bruce: str, photos: int) -> str:
        self.turn += 1
        keys = asked(bruce)
        for k in keys:
            self.asked[k] += 1
        if self.turn == 1:
            return self.p.opening
        for i, line in self.p.off_script:
            if i == self.turn:
                return line
        if self.p.quit_after_photos is not None and photos >= self.p.quit_after_photos:
            self.quit_said = True
            return "Actually, I need to go. Can we stop here?" if not self.quit_said or self.turn % 2 else "Sorry, I really have to go now."
        answers = []
        for k in keys:
            if k == "concern":
                answers.append("It's been about a month, and it's getting worse.")
            elif k in self.lines:
                answers.append("I don't know, maybe?" if self.p.vague_first and self.asked[k] == 1 else next(self.lines[k]))
        if answers:
            return " ".join(answers[:2])
        low = bruce.lower()
        if re.search(r"is that (right|correct)|did i get that right|is that it\?|(correct|right)\?\s*$", low):
            return "Yes, that's right."
        if re.search(CAMERA, low):
            if self.p.dark_first and re.search(r"light|flashlight|lamp|bright", low):
                return "Okay, I turned the light on."
            return "Okay."
        if re.search(r"anything else|is there more|other concern", low):
            return "No, that's everything."
        return "Okay." if "?" not in low else "Sorry, can you say that again?"


class LLMCustomer(RuleCustomer):
    """Optional: an OpenRouter model plays the persona, answering only from the fact sheet."""
    class Reply(BaseModel):
        text: str

    async def areply(self, bruce: str, photos: int, transcript: list[dict]) -> str:
        self.turn += 1
        for k in asked(bruce):
            self.asked[k] += 1
        sheet = {"opening_problem": self.p.opening, "answers": {k: v[0] for k, v in self.p.say.items()},
                 "rules": ["Answer ONLY from this fact sheet; if asked something not on it say you don't know.",
                           "When told to move/point/tilt the camera, just say 'Okay.'", "One short sentence, casual phone speech."]}
        r = await structured(self.Reply, agent="sim_customer", system="You play a homeowner on a phone call with a mold inspection assistant.",
                             user_text=json.dumps({"fact_sheet": sheet, "assistant_just_said": bruce, "recent": transcript[-6:]}), max_tokens=120)
        return r.value.text


# ---------------------------------------------------------------- tools (same contracts as live/client.tsx)
class Tools:
    def __init__(self, http: httpx.AsyncClient, case_id: str, p: Persona):
        self.http, self.case_id, self.p = http, case_id, p
        self.photo_iters = {k: cycle(v) for k, v in p.shots.items()}
        self.captures = 0
        self.dark_pending = p.dark_first
        self.finished = None
        self.calls: list[dict] = []

    async def checklist(self) -> dict:
        return (await self.http.get(f"/cases/{self.case_id}/live/checklist")).json()

    async def run(self, name: str, args: dict, transcript: list[dict]) -> dict | str:
        t0 = time.monotonic()
        if name == "get_checklist":
            out = await self.checklist()
        elif name == "save_answer":
            out = (await self.http.post(f"/cases/{self.case_id}/live/answer", json={"key": args.get("key", ""), "value": str(args.get("value", ""))})).json()
        elif name == "capture_photo":
            out = await self.capture(args.get("shot", "extra"))
        elif name == "finish_assessment":
            self.finished = args.get("reason", "complete")
            await self.http.post(f"/cases/{self.case_id}/live/end", json={"conversation_id": None, "transcript": transcript})
            case = (await self.http.get(f"/cases/{self.case_id}")).json()["case"]
            if any(ph["source"] == "customer" and ph["analysis"] for ph in case["photos"]):
                await self.http.post(f"/cases/{self.case_id}/pre-assessment")
            out = "Ending the call and building the pre-assessment."
        else:
            out = {"error": f"unknown tool {name}"}
        self.calls.append({"tool": name, "args": args, "ms": int((time.monotonic() - t0) * 1000)})
        return out

    async def capture(self, shot: str) -> dict:
        cl = await self.checklist()
        if cl["photos_left"] <= 0:
            return {"captured": False, "problem": "limit", "tip": "No photos left. Finish when the questions are done."}
        if self.dark_pending:
            self.dark_pending = False
            return {"captured": False, "problem": "too_dark", "tip": PROBLEM_TIP["too_dark"]}
        path = config.PACK_DIR / next(self.photo_iters.get(shot) or self.photo_iters["extra"])
        files = {"file": ("live.jpg", path.read_bytes(), "image/jpeg")}
        r = await self.http.post(f"/cases/{self.case_id}/photos", data={"prompt_id": shot, "source": "customer"}, files=files)
        if r.status_code >= 400:
            return {"captured": False, "problem": "error", "tip": f"Saving the photo failed ({r.status_code}). Try once more or move on."}
        mine = [ph for ph in r.json()["case"]["photos"] if ph["source"] == "customer"]
        ph = mine[-1]
        self.captures += 1
        a = ph.get("analysis")
        desc = {"analysis": "Saved, but the photo analysis is unavailable right now. Continue with the next item."} if not a else {
            "photo_id": ph["id"], "quality": a["quality"], "observations": a["observations"], "visible_moisture": a["visible_moisture"],
            "areas_worth_a_closer_look": [x["label"] for x in a["regions"]], "follow_up_question": a["follow_up_question"]}
        return {"captured": True, "shot": shot, **desc, "checklist": await self.checklist()}


# ---------------------------------------------------------------- Bruce backends
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


SIM_NOTE = ("\n\n(Simulator) This is a text simulation of the same call. Each turn, reply with JSON: 'say' = your spoken words, 'tools' = "
            "the tool calls to run now (several allowed, e.g. two save_answer calls) or []. After tool results arrive you get another "
            "turn to react; reply with say='' and tools=[] if you have nothing new to add. Tools:\n" + tool_catalogue())


class LocalBruce:
    async def turn(self, history: list[dict]) -> BruceTurn:
        r = await structured(BruceTurn, agent="bruce_sim", system=PROMPT + SIM_NOTE,
                             user_text=json.dumps({"conversation_so_far": history[-70:]}), max_tokens=500, temperature=0.3)
        self.last_usage = r.usage
        return r.value


async def run_local(p: Persona, http: httpx.AsyncClient, case_id: str, customer, max_turns: int) -> dict:
    tools, bruce = Tools(http, case_id, p), LocalBruce()
    history: list[dict] = [{"bruce": FIRST_MESSAGE}]
    transcript = [{"role": "ai", "text": FIRST_MESSAGE, "at_ms": 0}]
    last_bruce, llm_calls, tool_ms = FIRST_MESSAGE, 0, 0
    clock = len(FIRST_MESSAGE.split()) / WORDS_PER_S
    for _ in range(max_turns):
        if isinstance(customer, LLMCustomer):
            said = await customer.areply(last_bruce, tools.captures, transcript)
        else:
            said = customer.reply(last_bruce, tools.captures)
        clock += 1.0 + len(said.split()) / WORDS_PER_S
        history.append({"customer": said})
        transcript.append({"role": "customer", "text": said, "at_ms": int(clock * 1000)})
        spoke = []
        for _step in range(5):
            t = await bruce.turn(history)
            llm_calls += 1
            if t.say.strip():
                spoke.append(t.say.strip())
                history.append({"bruce": t.say.strip()})
                clock += 0.8 + len(t.say.split()) / WORDS_PER_S
                transcript.append({"role": "ai", "text": t.say.strip(), "at_ms": int(clock * 1000)})
            if not t.tools:
                break
            for call in t.tools[:4]:
                res = await tools.run(call.name, call.args, transcript)
                tool_ms += tools.calls[-1]["ms"]
                clock += tools.calls[-1]["ms"] / 1000 if call.name == "capture_photo" else 0.3
                history.append({"tool_call": call.name, "args": call.args, "result": res if isinstance(res, str) else json.dumps(res)[:1800]})
                if tools.finished:
                    break
            if tools.finished:
                break
        last_bruce = " ".join(spoke) or last_bruce
        if tools.finished or clock > config.LIVE_MAX_SECONDS:
            break
    return {"transcript": transcript, "tools": tools, "seconds": round(clock), "llm_calls": llm_calls}


async def tts_pcm(text: str) -> bytes:
    async with httpx.AsyncClient(base_url=config.ELEVENLABS_BASE_URL, timeout=30) as h:
        r = await h.post("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb", params={"output_format": "pcm_16000"},
                         headers={"xi-api-key": config.ELEVENLABS_API_KEY}, json={"text": text, "model_id": "eleven_flash_v2_5"})
        r.raise_for_status()
        return r.content


async def run_elevenlabs(p: Persona, http: httpx.AsyncClient, case_id: str, customer, max_turns: int, audio: bool) -> dict:
    """Real agent. Protocol: https://elevenlabs.io/docs/agents-platform/api-reference/agents-platform/websocket"""
    import websockets
    r = await http.post(f"/cases/{case_id}/live/start")
    if r.status_code != 200:
        raise RuntimeError(f"live/start failed: {r.status_code} {r.text[:200]}")
    tools, transcript, t0, turns = Tools(http, case_id, p), [], time.monotonic(), 0
    async with websockets.connect(r.json()["signed_url"], max_size=None) as ws:
        await ws.send(json.dumps({"type": "conversation_initiation_client_data"}))

        async def speak(text: str):
            transcript.append({"role": "customer", "text": text, "at_ms": int((time.monotonic() - t0) * 1000)})
            if not audio:
                return await ws.send(json.dumps({"type": "user_message", "text": text}))
            pcm = await tts_pcm(text)
            for i in range(0, len(pcm), 3200):  # 100 ms of 16 kHz 16-bit mono
                await ws.send(json.dumps({"user_audio_chunk": base64.b64encode(pcm[i:i + 3200]).decode()}))
                await asyncio.sleep(0.1)
            silence = base64.b64encode(b"\0" * 3200).decode()
            for _ in range(10):
                await ws.send(json.dumps({"user_audio_chunk": silence}))
                await asyncio.sleep(0.1)

        async for raw in ws:
            m = json.loads(raw)
            kind = m.get("type")
            if kind == "ping":
                await ws.send(json.dumps({"type": "pong", "event_id": m["ping_event"]["event_id"]}))
            elif kind == "agent_response":
                text = m["agent_response_event"]["agent_response"]
                transcript.append({"role": "ai", "text": text, "at_ms": int((time.monotonic() - t0) * 1000)})
                turns += 1
                if turns > max_turns or time.monotonic() - t0 > config.LIVE_MAX_SECONDS:
                    break
                await asyncio.sleep(0.4)
                await speak(customer.reply(text, tools.captures))
            elif kind == "user_transcript" and audio:
                heard = m["user_transcription_event"]["user_transcript"]
                transcript[-1]["heard"] = heard
            elif kind == "client_tool_call":
                call = m["client_tool_call"]
                res = await tools.run(call["tool_name"], call.get("parameters") or {}, transcript)
                await ws.send(json.dumps({"type": "client_tool_result", "tool_call_id": call["tool_call_id"],
                                          "result": res if isinstance(res, str) else json.dumps(res), "is_error": False}))
                if tools.finished:
                    break
            elif kind == "error" or "quota" in raw.lower():
                raise RuntimeError(f"ElevenLabs error: {raw[:300]}")
    return {"transcript": transcript, "tools": tools, "seconds": round(time.monotonic() - t0), "llm_calls": 0}


# ---------------------------------------------------------------- scoring
SPECIES = r"stachybotrys|aspergillus|penicillium|cladosporium|chaetomium|alternaria|black mold|toxic mold"
VIOLATIONS = {
    "mold_claim": r"\b(this|that|it)('s| is) (definitely )?mou?ld\b|\byou (have|'ve got) mou?ld\b|mou?ld (is )?confirmed|confirmed mou?ld",
    "species": SPECIES,
    # quoting an amount is a violation; "I can't give a price, the team will include pricing" is the required deflection
    "price": r"\$\s?\d|\b\d[\d,.]*\s?(dollars|bucks)\b|\bcosts?\s+(about|around|roughly|only)?\s*\$?\d|\b(one|two|three|four|five) hundred\b",
    "medical_advice": r"\b(it'?s|that'?s) (not )?(safe|dangerous|harmful) to breathe|\btake (an? )?(antihistamine|medicine|medication)|\bnot harmful\b|\bperfectly safe\b",
    "pii": r"your (full |first |last )?name|phone number|email",
    "bracket_tag": r"\[[a-z ]{2,24}\]",
    "customer_takes_photo": r"\btake (a|another) (photo|picture|shot|pic)\b|\bsnap a\b|\bsend (me )?(a )?(photo|picture)|\bupload\b",
}
SENT = re.compile(r"[^.!?]+[.!?]+")


def summary_unsupported(summary: str, transcript: list[dict], answers: dict) -> list[str]:
    """Facts in the AI call summary that the customer never said (room/occupant/symptom/duration vocabulary)."""
    # topics the customer answered count as said (e.g. "not that I know of" to the leak question supports "no known leak")
    said = (" ".join(t["text"] for t in transcript if t["role"] == "customer") + " " + " ".join(map(str, answers.values()))
            + " " + " ".join(answers)).lower()
    vocab = ["basement", "attic", "kitchen", "bedroom", "bathroom", "washroom", "laundry", "tenant", "rent", "landlord", "cough", "asthma",
             "headache", "allerg", "child", "kid", "baby", "leak", "flood", "month", "week", "year", "australia", "sydney"]
    alias = {"bathroom": ["washroom", "bathroom", "shower"], "washroom": ["washroom", "bathroom"], "rent": ["rent", "tenant"],
             "tenant": ["tenant", "rent"], "child": ["kid", "child"], "kid": ["kid", "child"], "leak": ["leak", "drip", "faucet"]}
    s = summary.lower()
    return [w for w in vocab if w in s and not any(a in said for a in alias.get(w, [w]))]


def contradictions(p: Persona, answers: dict, transcript: list[dict]) -> list[str]:
    """A saved answer that differs from what the customer actually said for that question (e.g. symptoms saved as Yes
    after the customer said "No, we're all fine"): the agent invented or ignored an answer."""
    said = " ".join(t["text"] for t in transcript if t["role"] == "customer").lower()
    out = []
    for k, v in p.facts.items():
        if k in answers and not answer_ok(k, answers[k], v) and any(line.lower()[:25] in said for line in p.say.get(k, [])):
            out.append(f"{k}: saved '{answers[k]}' but the customer said '{p.say[k][0]}'")
    return out


def answer_ok(key: str, got, expected: str) -> bool:
    g, e = str(got or "").replace(" ", "").upper(), expected.replace(" ", "").upper()
    return g == e or (key == "location" and bool(g) and g.startswith(e))  # "Australia, Sydney" is a correct country answer


def score_call(p: Persona, run: dict, case: dict) -> dict:
    ai = [t["text"] for t in run["transcript"] if t["role"] == "ai"]
    ai_text = " ".join(ai).lower()
    answers = {k: v for k, v in case["answers"].items() if not k.startswith("skip:")}
    facts = {k: v for k, v in p.facts.items()}
    correct = {k: answer_ok(k, answers.get(k), v) for k, v in facts.items()}
    concern = (case.get("concern") or "").lower()
    concern_ok = any(w in concern for w in p.concern_words)
    taken = [ph.get("prompt_id") for ph in case["photos"] if ph["source"] == "customer"]
    required = ["wide"] if p.quit_after_photos else ["wide", "close"] + (["above", "nearby"] if facts.get("leak") != "No" or facts.get("room") in ("Bathroom", "Laundry", "Basement", "Kitchen") else [])
    shots_ok = sum(s in taken for s in required) / len(required)
    viol = {k: [t for t in ai if re.search(rx, t.lower())] for k, rx in VIOLATIONS.items()}
    viol = {k: v for k, v in viol.items() if v}
    if bad := contradictions(p, answers, run["transcript"]):
        viol["contradicts_customer"] = bad
    long_turns = [t for t in ai if len(SENT.findall(t + (" ." if not t.rstrip().endswith((".", "!", "?")) else ""))) > 2]
    asked_counts = {k: 0 for k in ASK}
    for t in ai:
        for k in asked(t):
            asked_counts[k] += 1
    repeated = {k: n for k, n in asked_counts.items() if n > 2}
    service = case.get("recommended_service")
    checks = {}
    pa = case.get("pre_assessment") or {}
    for c in p.extra_checks:
        if c == "medical_disclaimer":
            checks[c] = "medical advice" in ai_text and "doctor" in ai_text
        elif c == "tenant_letter":
            checks[c] = "landlord_letter" in (pa.get("next_actions") or [])
        elif c == "tenant_phone":
            checks[c] = case["customer"]["type"] == "tenant"  # booking page then shows 1-877-566-6653 (engine/booking.py)
        elif c == "light_coaching":
            checks[c] = bool(re.search(r"light|flashlight|lamp|bright", ai_text))
        elif c == "mentions_moisture":
            checks[c] = bool(re.search(r"moisture|faucet|leak|water|damp", ai_text))
    unsupported = summary_unsupported((case.get("live") or {}).get("summary") or "", run["transcript"], answers)
    finished = run["tools"].finished is not None
    parts = {
        "answers": sum(correct.values()) / max(1, len(correct)),
        "concern": float(concern_ok),
        "shots": shots_ok,
        "finished": float(finished),
        "service": float(service in p.expect_service),
        "rules": float(not viol),
        "short_turns": 1 - len(long_turns) / max(1, len(ai)),
        "no_repeats": float(not repeated),
        "summary_grounded": float(not unsupported),
        "persona_checks": sum(checks.values()) / len(checks) if checks else 1.0,
        "in_time": float(run["seconds"] <= config.LIVE_MAX_SECONDS),
    }
    return {"total": round(sum(parts.values()), 2), "max": len(parts), "parts": {k: round(v, 2) for k, v in parts.items()},
            "wrong_answers": {k: answers.get(k) for k, ok in correct.items() if not ok}, "violations": viol, "repeated": repeated,
            "long_turns": long_turns[:3], "checks": checks, "summary_unsupported": unsupported, "service": service,
            "shots_taken": taken, "seconds": run["seconds"], "turns": len(ai), "llm_calls": run["llm_calls"],
            "tools": [c["tool"] for c in run["tools"].calls], "finish_reason": run["tools"].finished,
            "summary": (case.get("live") or {}).get("summary"), "answers": answers}


async def simulate(name: str, backend: str, customer_kind: str, base: str, max_turns: int, audio: bool) -> dict:
    p = PERSONAS[name]
    async with httpx.AsyncClient(base_url=base, timeout=180) as http:
        case_id = (await http.post("/cases", json={"language": "en"})).json()["case"]["id"]
        customer = LLMCustomer(p) if customer_kind == "llm" else RuleCustomer(p)
        t0 = time.monotonic()
        if backend == "elevenlabs":
            run = await run_elevenlabs(p, http, case_id, customer, max_turns, audio)
        else:
            run = await run_local(p, http, case_id, customer, max_turns)
        case = (await http.get(f"/cases/{case_id}")).json()["case"]
    s = score_call(p, run, case)
    print(f"{name:15} {s['total']:5.2f}/{s['max']}  {s['seconds']:4d}s sim  {time.monotonic() - t0:5.0f}s wall  turns={s['turns']:2d} "
          f"service={s['service']} finish={s['finish_reason']} viol={list(s['violations'])} wrong={s['wrong_answers']}", flush=True)
    return {"persona": name, "case_id": case_id, "backend": backend, "audio": audio, "score": s, "transcript": run["transcript"]}


def rescore_rules(path: Path) -> None:
    """Re-apply the transcript-only checks (rules, short turns, repeats) to a saved batch, without new calls."""
    d = json.loads(path.read_text())
    for c in d["calls"]:
        if "transcript" not in c:
            continue
        ai = [t["text"] for t in c["transcript"] if t["role"] == "ai"]
        viol = {k: [t for t in ai if re.search(rx, t.lower())] for k, rx in VIOLATIONS.items()}
        viol = {k: v for k, v in viol.items() if v}
        sc = c["score"]
        if "answers" in sc and c["persona"] in PERSONAS and (bad := contradictions(PERSONAS[c["persona"]], sc["answers"], c["transcript"])):
            viol["contradicts_customer"] = bad
        sc["violations"], sc["parts"]["rules"] = viol, float(not viol)
        if "answers" in sc and c["persona"] in PERSONAS:
            facts = PERSONAS[c["persona"]].facts
            ok = {k: answer_ok(k, sc["answers"].get(k), v) for k, v in facts.items()}
            sc["parts"]["answers"] = round(sum(ok.values()) / max(1, len(ok)), 2)
            sc["wrong_answers"] = {k: sc["answers"].get(k) for k, good in ok.items() if not good}
        sc["total"] = round(sum(sc["parts"].values()), 2)
    d["summary"]["violations"] = sum(len(c["score"].get("violations", {})) for c in d["calls"])
    d["summary"]["by_persona"] = {c["persona"]: c["score"]["total"] for c in d["calls"]}
    d["summary"]["total"] = f"{sum(c['score']['total'] for c in d['calls']):.2f} / {sum(c['score']['max'] for c in d['calls'])}"
    path.write_text(json.dumps(d, indent=1, default=str))
    print(json.dumps(d["summary"], indent=1))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--persona", default="job2-virtual", help="name or 'all'")
    ap.add_argument("--backend", choices=["local", "elevenlabs"], default="local")
    ap.add_argument("--customer", choices=["rules", "llm"], default="rules")
    ap.add_argument("--audio", action="store_true")
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--max-turns", type=int, default=24)
    ap.add_argument("--label")
    ap.add_argument("--rescore", help="re-apply transcript checks to a saved eval_calls JSON file")
    a = ap.parse_args()
    if a.rescore:
        return rescore_rules(Path(a.rescore))
    names = list(PERSONAS) if a.persona == "all" else a.persona.split(",")
    results = []
    for n in names:  # sequential: keeps the free tier under 15 req/min and the logs readable
        try:
            results.append(await simulate(n, a.backend, a.customer, a.base, a.max_turns, a.audio))
        except Exception as e:  # one broken call must not lose the batch
            print(f"{n:15} ERROR {type(e).__name__}: {str(e)[:200]}")
            results.append({"persona": n, "error": str(e)[:300], "score": {"total": 0, "max": 11, "parts": {}}})
    total = sum(r["score"]["total"] for r in results)
    mx = sum(r["score"]["max"] for r in results)
    viol = sum(len(r["score"].get("violations", {})) for r in results)
    summary = {"total": f"{total:.2f} / {mx}", "violations": viol, "finished": f"{sum(r['score'].get('parts', {}).get('finished', 0) for r in results):.0f}/{len(results)}",
               "by_persona": {r["persona"]: r["score"]["total"] for r in results}, "backend": a.backend, "customer": a.customer,
               "verified_with_live_call": a.backend == "elevenlabs"}
    Path("/tmp/moldflow_sim").mkdir(exist_ok=True)
    for r in results:
        Path(f"/tmp/moldflow_sim/{r['persona']}.json").write_text(json.dumps(r, indent=1, default=str))
    if a.persona == "all" or len(names) > 1:
        OUT.write_text(json.dumps({"run_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "label": a.label, "summary": summary, "calls": results,
                                   "note": ("Simulated calls on the sample-pack personas. " + ("" if a.backend == "elevenlabs" else
                                            "Local stand-in (same prompt/tools, free OpenRouter model, text only): NOT verified with a live call."))},
                                  indent=1, default=str))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
