"""Deterministic rules for the live camera + voice pre-assessment.

The ElevenLabs agent drives the conversation, but what still has to be collected (questions + photo shots) and which
answers are acceptable is decided here, from the same question/photo lists the tap-through intake uses. That keeps
pricing, routing and reports working unchanged whichever way the customer came in.
Why Bruce's rules live in code: docs/04_decisions.md D6, D19."""
import re

from app import config
from app.engine import photo_plan, rules
from app.models.passport import Case

WET_ROOMS = ("Bathroom", "Basement", "Laundry", "Kitchen")
FREE_TEXT = {
    "location": "Postal code, or the country if outside Canada",
    "concern": "What the customer is worried about, in their own words (how long, what changed, what they tried)",
}
SHOT_IDS = ["wide", "close", "above", "nearby", "scale", "extra"]


def _chips() -> dict[str, tuple[str, list[str]]]:
    return {c.key: (c.text, c.options) for c in rules.CHIPS["en"]}


def _prompts() -> dict[str, str]:
    return {p.prompt_id: p.text for p in rules.PHOTO_PROMPTS["en"]}


def customer_photos(case: Case):
    return [p for p in case.photos if p.source == "customer"]


def required_shots(case: Case) -> list[str]:
    """Same adaptive logic as the tap-through intake: 'above' and 'nearby' only matter when moisture is plausible."""
    shots = ["wide", "close"]
    if case.answers.get("leak") != "No" or case.answers.get("room") in WET_ROOMS:
        shots += ["above", "nearby"]
    return shots


YES_NO_KEYS = ("symptoms", "odor", "leak")
UNSURE = r"not sure|unsure|maybe|kinda|kind of|sort of|i don'?t know|dunno|hard to say|no idea|possibly|i think so"
NO = r"\b(no|nope|nah|not really|none|nothing|never|not that i know|don'?t think so|all fine|we'?re fine|nobody)\b"
YES = r"\b(yes|yeah|yep|yup|definitely|sure|it does|there is|there'?s|a lot|strong|a little|a bit|slight|my (kid|son|daughter|child|wife|husband))\b"
SPOKEN = {
    "occupant": [(r"\b(rent|renting|tenant|lease|leasing)\b", "Tenant"), (r"\b(landlord|property manager|manage|rental property)\b", "Landlord / manager"),
                 (r"\b(own|owner|homeowner|mine|ours|bought)\b", "Owner")],
    "room": [(r"laundry|washer|dryer", "Laundry"), (r"bath|washroom|shower|toilet|en-?suite|\btub\b", "Bathroom"),
             (r"basement|cellar|crawl ?space", "Basement"), (r"kitchen", "Kitchen"), (r"bedroom|closet", "Bedroom"), (r"attic|loft", "Attic")],
}
NUM_WORDS = {"zero": "0", "oh": "0", "o": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
             "eight": "8", "nine": "9", "to": "2", "too": "2", "for": "4", "ate": "8"}
CANADA_WORDS = r"\b(canada|ontario|quebec|qu[eé]bec|ottawa|gatineau|montr[eé]al|toronto|laval|kingston|sherbrooke)\b"


def normalize_postal(text: str) -> str | None:
    """Canadian postal code from typed or transcribed speech ('k1a0b1', 'K one A zero B one') -> 'K1A 0B1' (or 'K1A' prefix)."""
    t = text.upper()
    if m := re.search(r"\b([A-Z])\s*(\d)\s*([A-Z])[\s-]*(\d)\s*([A-Z])\s*(\d)\b", t):
        return f"{m[1]}{m[2]}{m[3]} {m[4]}{m[5]}{m[6]}"
    toks = re.findall(r"[a-z]+|\d", text.lower())
    chars = "".join(NUM_WORDS.get(tok, tok.upper() if len(tok) == 1 else ("" if len(tok) > 1 else tok)) for tok in toks)
    if m := re.search(r"([A-Z]\d[A-Z])(\d[A-Z]\d)?", chars):
        return f"{m[1]} {m[2]}" if m[2] else m[1]
    if m := re.search(r"\b([A-Z]\d[A-Z])\b", t):
        return m[1]
    return None


def validate_answer(key: str, value: str) -> str:
    """Return the canonical stored value, or raise ValueError with a message the agent can act on.
    Understands spoken answers ('nope', 'kinda', 'I rent', 'the laundry room') so the agent needs fewer re-asks."""
    v = rules.canon(value.strip())
    if key in FREE_TEXT:
        if not v:
            raise ValueError(f"'{key}' needs a non-empty answer.")
        if key == "location":
            if postal := normalize_postal(v):
                return postal
            if re.search(CANADA_WORDS, v.lower()):
                raise ValueError("That's in Canada: ask for the postal code (letter-number-letter, number-letter-number), then read it back.")
            return re.sub(r"^(i'?m|i am|we'?re|we are)\s+(in|from)\s+", "", v, flags=re.I).strip(" .")[:120]
        return v[:500]
    chips = _chips()
    if key not in chips:
        raise ValueError(f"Unknown question '{key}'. Valid keys: {', '.join([*chips, *FREE_TEXT])}.")
    options = chips[key][1]
    low = v.lower()
    exact = next((o for o in options if o.lower() == low), None)
    if exact:
        return exact
    for rx, canon_value in SPOKEN.get(key, []):
        if re.search(rx, low):
            return canon_value
    if key in YES_NO_KEYS:
        lead = re.match(r"\W*(yes|yeah|yep|yup|no|nope|nah)\b", low)
        if lead:  # an explicit leading yes/no wins over hedges later in the sentence ("Yes, it smells kind of musty")
            return "No" if lead[1] in ("no", "nope", "nah") else "Yes"
        if re.search(UNSURE, low):
            if "Not sure" in options:
                return "Not sure"
        elif re.search(NO, low):
            return "No"
        elif re.search(YES, low):
            return "Yes"
    prefix = [o for o in options if o.lower().startswith(low) or low.startswith(o.lower().split(" ")[0])]
    if len(prefix) == 1:
        return prefix[0]
    raise ValueError(f"'{value}' is not one of the allowed answers for '{key}': {', '.join(options)}. Ask the customer to pick one.")


def next_step(case: Case, missing_q: list[dict], missing_shots: list[dict]) -> dict:
    """One concrete suggestion so the agent interleaves photos and questions: wide shot first, then about one photo per two
    answered questions, the concern early, location last."""
    photos = customer_photos(case)
    answered = [k for k in case.answers if not k.startswith("skip:") and k not in ("concern", "location")]
    q_keys = [q["key"] for q in missing_q]
    if not photos and missing_shots:
        return {"do": "capture", "shot": missing_shots[0]["shot"], "coach": missing_shots[0]["instruction"]}
    if "concern" in q_keys and len(photos) <= 1:
        return {"do": "ask", "key": "concern", "hint": FREE_TEXT["concern"]}
    if missing_shots and (len(photos) <= len(answered) // 2 or not [k for k in q_keys if k != "concern"]):
        return {"do": "capture", "shot": missing_shots[0]["shot"], "coach": missing_shots[0]["instruction"]}
    rest = [q for q in missing_q if q["key"] not in ("concern", "location")] or [q for q in missing_q if q["key"] != "concern"]
    if rest:
        return {"do": "ask", "key": rest[0]["key"], "allowed_answers": rest[0]["allowed_answers"]}
    return {"do": "finish"}


def plan_checklist(case: Case, plan: list) -> dict:
    """Photo-coaching call: the questions were answered before the call, so only the personalized shot list remains."""
    photos = customer_photos(case)
    taken = [p.prompt_id or "extra" for p in photos]
    skipped = [k[5:] for k in case.answers if k.startswith("skip:")]
    shots = photo_plan.plan_dicts(plan)
    missing = [s for s in shots if s["id"] not in taken and s["id"] not in skipped]
    left = max(0, config.LIVE_MAX_PHOTOS - len(photos))
    analyzed = sum(1 for p in photos if p.analysis)
    nxt = missing[0] if missing and left else None
    return {
        "mode": "photo_plan",
        "answered": {k: v for k, v in case.answers.items() if not k.startswith("skip:")},
        "plan": shots,
        "shots_taken": taken,
        "shots_skipped": skipped,
        "missing_shots": [{"shot": s["id"], "title": s["title"], "instruction": s["instruction"]} for s in missing],
        "missing_questions": [],
        "photos_left": left,
        "ready_to_finish": not missing or not left,
        "photos_analyzed": analyzed,
        "can_finish_early": analyzed > 0,
        "next_step": {"do": "capture", "shot": nxt["id"], "title": nxt["title"], "coach": nxt["instruction"]} if nxt else {"do": "finish"},
    }


def checklist(case: Case) -> dict:
    if plan := photo_plan.plan_for_case(case.answers):
        return plan_checklist(case, plan)
    chips, prompts = _chips(), _prompts()
    answered = {k: v for k, v in case.answers.items() if not k.startswith("skip:")}
    missing_q = [{"key": k, "ask": text, "allowed_answers": opts} for k, (text, opts) in chips.items() if k not in answered]
    missing_q += [{"key": k, "ask": desc, "allowed_answers": "free text"} for k, desc in FREE_TEXT.items() if k not in answered]
    photos = customer_photos(case)
    taken = [p.prompt_id or "extra" for p in photos]
    missing_shots = [{"shot": s, "instruction": prompts[s]} for s in required_shots(case) if s not in taken]
    analyzed = sum(1 for p in photos if p.analysis)
    return {
        "answered": answered,
        "missing_questions": missing_q,
        "shots_taken": taken,
        "missing_shots": missing_shots,
        "optional_shots": [{"shot": "scale", "instruction": prompts["scale"]}] if "scale" not in taken else [],
        "photos_left": max(0, config.LIVE_MAX_PHOTOS - len(photos)),
        # 'concern' never blocks finishing: the end-of-call summary extracts it from the transcript if the agent didn't save it.
        "ready_to_finish": analyzed > 0 and not [q for q in missing_q if q["key"] != "concern"] and not missing_shots,
        "can_finish_early": analyzed > 0,
        "next_step": next_step(case, missing_q, missing_shots),
    }
