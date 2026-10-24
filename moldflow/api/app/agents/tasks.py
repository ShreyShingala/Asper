"""All MoldFlow agents. Each = prompt + Pydantic output model + deterministic post-processing."""
import json
import re
from datetime import date

from app.agents.llm import Result, structured
from app.engine import checks
from app.models.agents import AssessDraft, FindingsOut, FollowUpDraft, PhotoAnalysis, ReportDraft
from app.models.passport import ALLOWED_RESULTS, Case, Finding, Photo, Reading

LANG_NAME = {"en": "English", "fr": "French (Canadian)"}
_STOP = {"the", "and", "with", "below", "above", "under", "from", "that", "this", "shows", "show", "there", "visible", "is", "was", "were", "has"}


def _words(text: str) -> set[str]:
    return {w.rstrip("s") for w in re.findall(r"[a-z]{4,}", text.lower())} - _STOP


async def analyze_photo(case: Case, photo: Photo, image: bytes, prompt_text: str | None, fixture_key: str | None) -> Result:
    system = ("You pre-screen ONE photo sent by a homeowner or tenant to a mold inspection company. Describe only what is visible. "
              "Mark up to 3 'areas worth a closer look' as regions with labels starting 'look closer:'. "
              "If the photo shows instruments, test kits or thermal screens, describe them factually and do not infer mold. "
              "Set quality to too_dark/blurry if the photo is not usable. Ask one useful follow-up question an inspector would ask. "
              f"Write observations and the question in {LANG_NAME[case.language]}.")
    ctx = {"room": photo.room or case.answers.get("room"), "photo_prompt": prompt_text,
           "customer_answers": {k: v for k, v in case.answers.items() if not k.startswith("skip:")}}
    return await structured(PhotoAnalysis, agent="photo", system=system, user_text=json.dumps(ctx), images=[image],
                            fixture_key=fixture_key, max_tokens=900)


async def assess(case: Case, fixture_key: str | None) -> Result:
    system = ("You write a customer's pre-assessment for a mold inspection company from their answers and photo observations. "
              "Summarize what was reported and what is visible, list what photos cannot tell (hidden moisture, extent behind surfaces, "
              "whether growth is fungal, air quality), and suggest the most appropriate PAID next service: 'virtual' (small, visible, "
              "single area, no leak), 'onsite' (hidden/multiple areas, leaks, water damage, attic/structure), or 'iaq' (odour or health "
              "symptoms, especially without much visible growth). Never say no inspection is needed. Never mention prices. "
              "Write the summary directly TO the customer in the second person ('you', 'your photos'), warm and calm; first sentence <= 14 words. "
              f"Write in {LANG_NAME[case.language]}.")
    ctx = {"concern": case.concern, "answers": {k: v for k, v in case.answers.items() if not k.startswith("skip:")},
           "customer_type": case.customer.type,
           "photos": [{"id": p.id, "prompt": p.prompt_id, "observations": p.analysis.observations,
                       "visible_moisture": p.analysis.visible_moisture} for p in case.photos if p.analysis]}
    return await structured(AssessDraft, agent="assess", system=system, user_text=json.dumps(ctx), fixture_key=fixture_key, max_tokens=900)


async def findings_from_note(case: Case, room: str, note: str) -> tuple[list[Finding], Result]:
    system = ("You turn an inspector's quick field note into structured findings. Use ONLY facts stated in the note. One finding per distinct "
              "observation. Pick reading_kind/reading_result only if the note states a test or reading result. Allowed results per kind: "
              + json.dumps({k: sorted(v) for k, v in ALLOWED_RESULTS.items()})
              + ". The photo list is ONLY for choosing evidence_photo_ids (match by caption/room); it is NEVER a source of findings. "
              "If the note mentions one thing, return one finding. Never invent ids.")
    ctx = {"room": room, "note": note, "photos": [{"id": p.id, "room": p.room, "caption": p.caption_from_pack} for p in case.photos]}
    res = await structured(FindingsOut, agent="findings", system=system, user_text=json.dumps(ctx), max_tokens=900,
                           fixture_key=f"findings:{case.id}:{note.strip().lower()[:60]}")
    photo_ids = {p.id for p in case.photos}
    out, n = [], sum(1 for f in case.findings if f.source == "ai_structured")
    note_words = _words(note)
    for d in res.value.findings:
        if not (_words(d.observation) & note_words):  # grounding check: finding must come from the note
            continue
        ev = [i for i in d.evidence_photo_ids if i in photo_ids] or [p.id for p in case.photos if p.room == (d.room or room)][:1]
        if not ev:
            continue
        readings = []
        if d.reading_kind and d.reading_result and d.reading_result in ALLOWED_RESULTS[d.reading_kind]:
            readings.append(Reading(kind=d.reading_kind, result=d.reading_result, location=d.room or room, photo_ids=ev[:1]))
        n += 1
        out.append(Finding(id=f"AI{n}", room=room, observation=d.observation, readings=readings, evidence_photo_ids=ev,
                           source="ai_structured", confirmed=False))
    return out, res


async def draft_report(case: Case) -> tuple[ReportDraft, list[str], Result]:
    system = ("You draft the findings section of a professional mold inspection report from the inspector's recorded findings. "
              "Every sentence (claim) MUST cite at least one finding id or photo id from the input. Do not add facts. "
              "Group by room. Explicitly address the customer's original concern. Where the estimate scope excludes a room with findings, "
              "say so plainly using the staff resolution notes if given. Recommendations must cite findings. "
              "Limitations: list readings not recorded and that visual/thermal observations do not confirm mold without sampling.")
    ctx = {"customer_concern": case.concern,
           "findings": [{"id": f.id, "room": f.room, "observation": f.observation,
                         "readings": [f"{r.kind}: {r.result}" for r in f.readings], "photos": f.evidence_photo_ids}
                        for f in case.findings if f.confirmed],
           "recorded_recommendations": case.recommendations,
           "estimate_scope_areas": case.estimate.areas if case.estimate else [],
           "staff_resolution_notes": [f"{fl.message} -> {fl.resolution_note}" for fl in case.flags if fl.resolved and fl.resolution_note]}
    res = await structured(ReportDraft, agent="report", system=system, user_text=json.dumps(ctx), max_tokens=2500,
                           fixture_key=f"report:{case.id}")
    valid = {f.id for f in case.findings} | {p.id for p in case.photos}
    draft: ReportDraft = res.value
    dropped = []
    for sec in draft.sections:
        kept = []
        for c in sec.claims:
            c.cites = [x for x in c.cites if x in valid]
            (kept if c.cites else dropped).append(c if c.cites else c.text)
        sec.claims = kept
    recs = []
    for c in draft.recommendations:
        c.cites = [x for x in c.cites if x in valid]
        (recs if c.cites else dropped).append(c if c.cites else c.text)
    draft.recommendations = recs
    draft.sections = [s for s in draft.sections if s.claims]
    return draft, dropped, res


async def draft_followup(case: Case, as_of: date, prior_messages: list[str]) -> tuple[FollowUpDraft, list[str], Result]:
    est = case.estimate
    system = ("You draft ONE follow-up message to a customer who received a mold inspection report and estimate but has not accepted it. "
              "Answer their original concern directly using the recorded findings (e.g. what was found and the likely moisture sources). "
              "You may reference: the estimate number, what the scope covers, the total, and the expiry date. You must NOT create or mention "
              "discounts, percentages off, or new offers. Do not repeat generic check-ins like the prior messages. "
              "Use exactly 3 short sentences, <= 300 characters total: (1) answer 'where is it coming from' with the most likely moisture "
              "source(s) from findings with elevated moisture / failed tests; (2) what the estimate covers; (3) the expiry date + invite a question. "
              f"for SMS. Language: {LANG_NAME[case.language]}. If the customer is a tenant, offer a summary letter they can share with their landlord.")
    ctx = {"as_of": as_of.isoformat(), "customer_type": case.customer.type, "original_concern": case.concern,
           "findings": [{"id": f.id, "room": f.room, "observation": f.observation} for f in case.findings if f.confirmed],
           "estimate": {"number": est.id, "areas": est.areas, "total": str(est.total), "expires_on": est.expires_on.isoformat() if est.expires_on else None,
                        "status": est.status} if est else None,
           "prior_generic_messages_sent": prior_messages}
    res = await structured(FollowUpDraft, agent="followup", system=system, user_text=json.dumps(ctx), max_tokens=700,
                           fixture_key=f"followup:{case.id}:{as_of.isoformat()}")
    d: FollowUpDraft = res.value
    valid = {f.id for f in case.findings} | {p.id for p in case.photos}
    d.cites = [c for c in d.cites if c in valid]
    return d, checks.offer_check(d.body, d.uses_offer_token), res
