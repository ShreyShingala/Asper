"""Relationship-hub agents: fact extraction, inbound triage, outreach drafting, talking points.

Every agent tries the model (llm.structured, Pydantic output) and falls back to deterministic rules when the model is
unavailable (quota, outage, offline demo). The result always says which produced it ("ai" vs "rule") so the UI is honest.
Guardrails enforced in code, not left to the model: facts must quote the source verbatim; drafts only see facts that are
approved and allowed for messages (never health; household/children never; life events only with personalised-reminders
consent); prices never come from the model; the compliance footer is added later by messaging.send().
Why: docs/04_decisions.md D7, D9, D10, D17."""
import json
import re
from datetime import date

from app import clock
from app.agents.llm import AgentFailure, structured
from app.models.agents import FactDraft, FactsOut, OutreachDraft, TalkingPoints, TriageOut
from app.models.crm import Contact, Interaction, ProfileFact
from app.models.passport import Case

LANG = {"en": "English", "fr": "Canadian French"}


# ---------------------------------------------------------------- fact extraction
RULES: list[tuple[str, str, str, int | None, str | None]] = [
    # regex, category, fact template, follow-up month, follow-up reason
    (r"expecting (?:a|our|my)?\s*(?:first |second |third )?(?:baby|child)(?: in (\w+))?|(?:having|due with) a baby(?: in (\w+))?|on est enceinte|attend(?:ons)? un bébé",
     "household", "Expecting a baby{when}", None, "nursery humidity check a month before the due date (human call)"),
    (r"(?:daughter|son|kid|kids|child|children)\s+(?:starts?|is starting|going into|goes to)\s+(?:grade \w+|school|kindergarten|daycare)|(?:ma fille|mon fils)\s+commence l'école",
     "household", "School-age child starting school", 8, "back to school: ask how it's going, offer a bedroom humidity check"),
    (r"(?:renovat\w+|finishing|redoing|remodel\w+)\s+(?:the |our )?(?:basement|bathroom|kitchen|attic)|rénov\w+ (?:le sous-sol|la salle de bain)",
     "life_event", "Planning a renovation: {quote}", 3, "moisture check before the renovation closes the walls"),
    (r"(?:selling|listing|list) (?:the |our )?(?:house|home|condo|place)|vendre (?:la|notre) maison",
     "life_event", "Planning to sell the home", 4, "pre-listing inspection"),
    (r"\b(?:we|i)(?:'ve got|'ve| have| got)\s+(?:a |two |three )?(?:big |small |old |little )?(?:dog|dogs|cat|cats)|on a un chien",
     "home", "Pets at home: {quote}", None, None),
    (r"(?:asthma|allerg\w+|cough\w*|wheez\w+|headaches?|asthme|toux)", "health", "Health concern mentioned: {quote}", None, None),
    (r"(?:text|call|email) me (?:after|before|in the) [\w ]+|textez-moi après [\w ]+", "preference", "Contact preference: {quote}", None, None),
    (r"(?:work|on) (?:nights|night shifts?|evenings)|travaille de nuit", "work", "Works nights", None, None),
    (r"(?:flooded|water in the basement|basement flood\w*|inond\w+)", "home", "Past water/flooding: {quote}", None, None),
]
MONTHS = {m: i for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july", "august", "september",
                                      "october", "november", "december"], 1)}


def _rule_facts(text: str) -> list[FactDraft]:
    out = []
    for rx, cat, tpl, month, why in RULES:
        m = re.search(rx, text, re.I)
        if not m:
            continue
        start = max(text.rfind(ch, 0, m.start()) for ch in ".!?") + 1
        end = min([i for i in (text.find(".", m.end()), text.find("!", m.end()), text.find("?", m.end())) if i != -1] or [len(text)])
        quote = text[start:end].strip(" ,")
        when = next((g for g in m.groups() if g), None) if m.groups() else None
        fu = month
        if cat == "household" and when and when.lower() in MONTHS:
            fu = (MONTHS[when.lower()] - 2) % 12 + 1  # a month before the due date, rounded early
        out.append(FactDraft(text=tpl.format(when=f" in {when.capitalize()}" if when else "", quote=quote[:80]), category=cat, quote=quote,
                             confidence=0.75, follow_up_month=fu, follow_up_reason=why))
    return out


def grounded(fact: FactDraft, source: str) -> bool:
    norm = lambda s: re.sub(r"\s+", " ", s.lower()).strip(" .!?\"'")  # noqa: E731
    return bool(fact.quote.strip()) and norm(fact.quote) in norm(source)


async def extract_facts(text: str, kind: str) -> tuple[list[FactDraft], str]:
    """Returns (grounded facts, 'ai'|'rule')."""
    system = ("Extract durable facts about a customer from what THEY said to a mold inspection company. Only facts the customer "
              "stated about their home, household, life events, preferences, health or work. Each fact must include the customer's "
              "exact words as `quote` (copy verbatim). Store children only coarsely (e.g. 'school-age child'): never names, ages or "
              "schools. Return an empty list if there is nothing durable.")
    try:
        r = await structured(FactsOut, agent="extract_facts", system=system, user_text=json.dumps({"source_kind": kind, "text": text}), max_tokens=600)
        facts, by = r.value.facts, "ai"
    except AgentFailure:
        facts, by = _rule_facts(text), "rule"
    return [f for f in facts if grounded(f, text)], by


def to_follow_up(month: int | None) -> date | None:
    if not month:
        return None
    t = clock.today()
    d = date(t.year, month, 1 if month != 8 else 20)
    return d if d >= t else d.replace(year=t.year + 1)


# ---------------------------------------------------------------- context shared by drafts
def allowed_facts(contact: Contact, facts: list[ProfileFact]) -> list[ProfileFact]:
    """Only facts a message may reference. Health and household never; life events only with personalised consent."""
    ok = []
    for f in facts:
        if f.status != "approved" or f.message_use != "light" or f.category in ("health", "household"):
            continue
        if f.category == "life_event" and not contact.consent.personalised_reminders:
            continue
        ok.append(f)
    return ok


SOURCE_CLUES = {("ball_slope", "failed"): "a shower floor that doesn't drain properly (failed ball-slope test)",
                ("moisture", "elevated"): "elevated moisture readings", ("temp_rh_dew", "elevated"): "high humidity"}


def concern_and_sources(case: Case | None) -> tuple[str, list[str]]:
    """Likely moisture SOURCES (leaks, drainage, humidity): a positive swab shows growth, not where water comes from."""
    if not case:
        return "", []
    sources = []
    for f in case.findings:
        clues = [SOURCE_CLUES[(r.kind, r.result)] for r in f.readings if (r.kind, r.result) in SOURCE_CLUES]
        if f.confirmed and clues:
            sources.append(f"the {f.room.lower()} ({', '.join(dict.fromkeys(clues))})")
    return case.concern, sources[:2]


# ---------------------------------------------------------------- triage
HEALTH = re.compile(r"danger|safe|health|sick|breath|asthma|cough|kids?|baby|toxic|dangereux|santé|respir", re.I)
YES = re.compile(r"\b(ok|okay|yes|yeah|sure|let'?s do it|go ahead|book (it|me)|sounds good|d'accord|oui|allons-y)\b", re.I)
BOOK = re.compile(r"\b(book|appointment|come (out|by)|inspect|visit|rendez-vous|réserver)\b", re.I)
RESCHED = re.compile(r"\b(reschedule|another (day|time)|can't make|move my|déplacer|changer)\b", re.I)
COMPLAINT = re.compile(r"\b(angry|terrible|refund|lawyer|complain|scam|worst|unacceptable|plainte|remboursement)\b", re.I)
THANKS = re.compile(r"\b(thanks|thank you|merci)\b", re.I)


WHEN = re.compile(r"\b(when|what time|arriv\w*|coming|quelle heure|quand|arriver)\b", re.I)
CLEAN = re.compile(r"\b(bleach|clean (it|this)( myself)?|vinegar|scrub|wipe|javel|nettoyer)\b", re.I)
REPORT = re.compile(r"\b(report|results?|rapport|résultats?)\b", re.I)


def case_facts(case: Case | None) -> dict:
    """What the assistant may rely on about THIS customer's case (no health facts, no invented prices)."""
    if not case:
        return {}
    b = case.booking
    return {"stage": case.stage, "concern": case.concern, "room": case.answers.get("room"),
            "visit": b.slot_text if b and b.slot_date else None, "service": case.pre_assessment.service_price_text if case.pre_assessment else None,
            "pre_assessment": case.pre_assessment.summary if case.pre_assessment else None,
            "report_ready": bool(case.report and any(a.what == "report" for a in case.approvals))}


def _rule_triage(contact: Contact, text: str, open_estimate: dict | None, case: Case | None = None) -> TriageOut:
    fr = contact.language == "fr"
    cf = case_facts(case)
    if WHEN.search(text) and cf.get("visit"):
        return TriageOut(intent="question", reply=(f"Votre visite est prévue {cf['visit']}. Le technicien vous texte 30 minutes avant d'arriver." if fr else
                                                   f"Your visit is booked for {cf['visit']}. The technician will text you 30 minutes before arriving."))
    if CLEAN.search(text):
        return TriageOut(intent="question", reply=(
            "Pour une petite zone (moins d'environ 1 m²), Santé Canada conseille de l'eau et un détergent sans parfum, avec gants et masque; "
            "évitez l'eau de Javel. Plus grand, ou si ça revient: laissez-nous vérifier la source d'humidité." if fr else
            "For a small area (under about 1 m²), Health Canada suggests water and unscented detergent with gloves and a mask; skip bleach. "
            "If it's bigger or keeps coming back, let us find the moisture source first."))
    if REPORT.search(text) and case:
        return TriageOut(intent="question", reply=(("Votre rapport est prêt, je vous le renvoie par courriel." if cf.get("report_ready") else
                                                    "Votre rapport est en préparation; vous le recevrez par courriel dès qu'il est approuvé.") if fr else
                                                   ("Your report is ready; I'll email it to you again." if cf.get("report_ready") else
                                                    "Your report is being finalized; you'll get it by email as soon as it's approved.")))
    if COMPLAINT.search(text):
        return TriageOut(intent="complaint", reply=("Je suis désolé. Une personne de notre équipe vous rappelle aujourd'hui." if fr else
                                                    "I'm sorry about this. Someone from our team will call you today."), escalate=True)
    if open_estimate and YES.search(text):
        n = open_estimate.get("number", "")
        return TriageOut(intent="estimate_yes", wants_booking=True,
                         reply=(f"Merci! Je confirme l'estimation {n}. Voici le lien pour le dépôt et choisir une date: {{booking_link}}" if fr else
                                f"Great, thank you! I've marked estimate {n} as accepted. Here's the link to pay the deposit and pick a date: {{booking_link}}"))
    if RESCHED.search(text):
        return TriageOut(intent="reschedule", reply=("Pas de problème. Choisissez une nouvelle date ici: {booking_link}" if fr else
                                                     "No problem. Pick a new time here: {booking_link}"))
    if HEALTH.search(text) and "?" in text:
        return TriageOut(intent="question", wants_booking=True,
                         reply=("Nous ne pouvons pas donner d'avis médical: parlez-en à un médecin. Un test de qualité de l'air peut vérifier ce que l'on ne voit pas. "
                                "Voulez-vous une évaluation? {booking_link}" if fr else
                                "We can't give medical advice, so please check with a doctor. An air quality test can check what photos can't. "
                                "Want us to take a look? {booking_link}"))
    if BOOK.search(text) or "mold" in text.lower() or "moisissure" in text.lower():
        return TriageOut(intent="booking", wants_booking=True,
                         reply=("Merci de nous écrire. Vous pouvez nous montrer l'endroit en 3 minutes (sans application) et réserver ici: {booking_link}" if fr else
                                "Thanks for reaching out. You can show us the spot in 3 minutes (no app) and book a time here: {booking_link}"))
    if THANKS.search(text):
        return TriageOut(intent="thanks", reply="Avec plaisir!" if fr else "You're welcome! We're here if anything comes up.")
    return TriageOut(intent="other", escalate=True, reply=("Merci, une personne de notre équipe vous répond sous peu." if fr else
                                                           "Thanks, someone from our team will get back to you shortly."))


async def triage(contact: Contact, text: str, open_estimate: dict | None, case: Case | None,
                 thread: list[dict] | None = None) -> tuple[TriageOut, str]:
    concern, sources = concern_and_sources(case)
    system = ("You answer a customer's text for Mold Busters (mold inspection/remediation, Ontario + Quebec). Classify intent and "
              "write a short reply in the customer's language. Never diagnose mold, never give medical advice (say to check with a "
              "doctor), never state prices other than published service rates. Use '{booking_link}' where a booking link belongs. "
              "Escalate complaints, legal threats, landlord disputes or anything unclear.")
    ctx = {"language": LANG[contact.language], "customer_text": text, "open_estimate": open_estimate, "concern": concern, "findings": sources,
           "conversation_so_far": (thread or [])[-8:], "case": case_facts(case)}
    try:
        r = await structured(TriageOut, agent="triage_inbound", system=system, user_text=json.dumps(ctx), max_tokens=400)
        return r.value, "ai"
    except AgentFailure:
        return _rule_triage(contact, text, open_estimate, case), "rule"


# ---------------------------------------------------------------- outreach drafts
def _rule_draft(contact: Contact, trigger: str, ctx: dict, facts: list[ProfileFact]) -> OutreachDraft:
    fr = contact.language == "fr"
    first = contact.name.split()[0] if not contact.name.startswith("Sample") else ""
    hi = (f"Bonjour {first}, " if first else "Bonjour, ") if fr else (f"Hi {first}, " if first else "Hi, ")
    if trigger == "estimate_chase":
        n, total, until = ctx.get("number", ""), ctx.get("total", ""), ctx.get("valid_until", "")
        src = ctx.get("sources") or []
        concern = ctx.get("concern", "")
        if src:
            why = (f"la source d'humidité la plus probable est {src[0]}" if fr else f"the likely moisture source is {src[0]}, not the basement spot itself")
            body = (f"{hi}suite à votre question sur l'origine du problème: {why}. L'estimation {n} ({total}) couvre ces zones et reste valide jusqu'au {until}. Des questions?"
                    if fr else f"{hi}about your question on where it's coming from: {why}. Estimate {n} ({total}) covers those areas and holds until {until}. Any questions?")
        else:
            topic = concern.split(".")[0][:70] if concern else ("votre estimation" if fr else "your estimate")
            body = (f"{hi}je fais suite à notre visite ({topic}). L'estimation {n} ({total}) reste valide jusqu'au {until}. Voulez-vous qu'on en parle 5 minutes?"
                    if fr else f"{hi}following up on our visit ({topic}). Estimate {n} ({total}) holds until {until}. Want a quick 5-minute call to go over it?")
        return OutreachDraft(body=body, reason=f"Estimate {n} viewed but not accepted; answers the customer's own question" if src else f"Estimate {n} viewed but not accepted",
                             facts_used=[])
    if trigger == "storm_safety":
        area = ctx.get("area", "")
        body = (f"{hi}avertissement de pluie pour {area}. Si vous avez de l'eau au sous-sol: coupez le courant de la zone, retirez les objets, et ventilez dans les 24-48 h."
                if fr else f"{hi}there's a rainfall warning for {area}. If water gets into the basement: cut power to that area, move belongings up, and dry it out within 24-48 hours.")
        return OutreachDraft(body=body, reason=f"Safety check-in for the alert over {area} (no offer, not a commercial message)")
    if trigger == "storm_offer":
        area = ctx.get("area", "")
        past = next((f for f in facts if "flood" in f.text.lower() or "water" in f.text.lower()), None)
        lead = ("Comme vous avez déjà eu de l'eau au sous-sol, " if fr else "Since you've had water in the basement before, ") if past else ""
        body = (f"{hi}avertissement de pluie pour {area}. {lead}voulez-vous une vérification vidéo gratuite de 10 minutes après la pluie? {{booking_link}}"
                if fr else f"{hi}rainfall warning for {area}. {lead}want a free 10-minute video check after the rain? {{booking_link}}")
        return OutreachDraft(body=body, reason=f"Check-in with offer for the alert over {area}", facts_used=[past.id] if past else [])
    if trigger.startswith("moment:"):
        kind = trigger.split(":", 1)[1]
        f = next((x for x in facts if x.id == ctx.get("fact_id")), None)
        if kind == "post_remediation_check":
            body = (f"{hi}cela fait un an depuis vos travaux. Voulez-vous une vérification de suivi pour confirmer que tout est sec? {{booking_link}}"
                    if fr else f"{hi}it's been a year since your remediation. Want a quick follow-up check to confirm everything's still dry? {{booking_link}}")
        elif f:
            body = (f"{hi}vous nous aviez parlé de ceci: «{f.source.quote}». C'est le bon moment pour une vérification d'humidité. {{booking_link}}"
                    if fr else f"{hi}you mentioned \"{f.source.quote}\". It's a good time for a quick moisture check before then. {{booking_link}}")
        else:
            body = (f"{hi}petit rappel saisonnier: c'est le bon moment pour vérifier l'humidité du sous-sol. {{booking_link}}"
                    if fr else f"{hi}seasonal reminder: now's a good time to check basement humidity. {{booking_link}}")
        return OutreachDraft(body=body, reason=ctx.get("reason", kind), facts_used=[f.id] if f else [])
    return OutreachDraft(body=f"{hi}" + ("merci de votre confiance." if fr else "thanks for choosing Mold Busters."), reason=trigger)


async def draft(contact: Contact, trigger: str, ctx: dict, facts: list[ProfileFact], channel: str) -> tuple[OutreachDraft, str]:
    usable = allowed_facts(contact, facts)
    system = ("Write ONE message from Mold Busters (mold inspection/remediation) to a past or current customer. Language: "
              f"{LANG[contact.language]}. Channel: {channel} ({'<= 300 characters, no subject' if channel == 'sms' else 'short email with subject'}). "
              "Be specific to the context and helpful; answer the customer's own question when the context has one. Reference a fact "
              "only from `facts` and list its id in facts_used. Never diagnose mold, never give medical advice, never state or invent "
              "prices, discounts or offers beyond what the context gives. Put '{booking_link}' where a link belongs. Do NOT add a "
              "signature, unsubscribe line or company address (added automatically).")
    payload = {"trigger": trigger, "context": ctx, "facts": [{"id": f.id, "text": f.text, "quote": f.source.quote} for f in usable],
               "customer_first_name": contact.name.split()[0] if not contact.name.startswith("Sample") else None}
    try:
        r = await structured(OutreachDraft, agent="draft_outreach", system=system, user_text=json.dumps(payload, default=str), max_tokens=500)
        d = r.value
        d.facts_used = [x for x in d.facts_used if x in {f.id for f in usable}]
        return d, "ai"
    except AgentFailure:
        return _rule_draft(contact, trigger, ctx, usable), "rule"


# ---------------------------------------------------------------- talking points
def _rule_points(contact: Contact, facts: list[ProfileFact], interactions: list[Interaction]) -> list[str]:
    pts = []
    est = next((i for i in interactions if i.kind == "estimate" and i.meta.get("status") in ("viewed", "sent")), None)
    if est:
        pts.append(f"Estimate {est.meta.get('number', '')} (${est.amount:,.2f}) is {est.meta.get('status')} but not accepted: ask what's holding them back.")
    for f in sorted([f for f in facts if f.status == "approved"], key=lambda f: f.learned_at, reverse=True):
        if f.category == "health":
            continue
        when = f.learned_at.strftime("%b %d")
        src = {"call": "on a call", "bruce": "to Bruce", "sms": "by text", "email": "by email", "note": "(staff note)",
               "booking": "when booking", "form": "on the form"}.get(f.source.kind, "")
        pts.append(f"They mentioned {src} on {when}: \"{f.source.quote}\"" + (f" ({f.follow_up_reason})" if f.follow_up_reason else ""))
        if len(pts) >= 3:
            break
    if not pts and interactions:
        pts.append(f"Last contact: {interactions[0].summary} ({interactions[0].at.strftime('%b %d')}).")
    return pts[:3]


async def talking_points(contact: Contact, facts: list[ProfileFact], interactions: list[Interaction]) -> tuple[list[str], str]:
    rule = _rule_points(contact, facts, interactions)
    usable = [f for f in facts if f.status == "approved" and f.category != "health"]
    system = ("Write 2-3 short talking points a Mold Busters staff member can say on the next call with this customer, as natural "
              "scripts (not surveillance notes), each ending with where it came from (e.g. 'she told Bruce on Oct 24'). Use only the "
              "facts and history given. Never mention health details.")
    try:
        r = await structured(TalkingPoints, agent="talking_points", system=system, max_tokens=300, user_text=json.dumps(
            {"facts": [{"text": f.text, "quote": f.source.quote, "when": f.learned_at.date().isoformat(), "how": f.source.kind} for f in usable],
             "recent": [{"when": i.at.date().isoformat(), "what": i.summary} for i in interactions[:8]]}, default=str))
        return r.value.points[:3], "ai"
    except AgentFailure:
        return rule, "rule"
