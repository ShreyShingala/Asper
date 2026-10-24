"""Deterministic rules for the live camera + voice pre-assessment.

The ElevenLabs agent drives the conversation, but what still has to be collected (questions + photo shots) and which
answers are acceptable is decided here, from the same question/photo lists the tap-through intake uses. That keeps
pricing, routing and reports working unchanged whichever way the customer came in."""
from app import config
from app.engine import rules
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


def validate_answer(key: str, value: str) -> str:
    """Return the canonical stored value, or raise ValueError with a message the agent can act on."""
    v = rules.canon(value.strip())
    if key in FREE_TEXT:
        if not v:
            raise ValueError(f"'{key}' needs a non-empty answer.")
        return v[:500]
    chips = _chips()
    if key not in chips:
        raise ValueError(f"Unknown question '{key}'. Valid keys: {', '.join([*chips, *FREE_TEXT])}.")
    options = chips[key][1]
    low = v.lower()
    exact = next((o for o in options if o.lower() == low), None)
    prefix = [o for o in options if o.lower().startswith(low) or low.startswith(o.lower().split(" ")[0])]
    if exact or len(prefix) == 1:
        return exact or prefix[0]
    raise ValueError(f"'{value}' is not one of the allowed answers for '{key}': {', '.join(options)}. Ask the customer to pick one.")


def checklist(case: Case) -> dict:
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
    }
