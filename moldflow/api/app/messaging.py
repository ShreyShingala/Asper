"""The only way a message leaves MoldFlow: draft -> (approve) -> send() -> consent.check() -> outbox.
Inbound replies come in through receive(): STOP/HUMAN keywords, AI triage, fact extraction, estimate acceptance.
Sending is SIMULATED (status sent_simulated) until Twilio/Resend keys are configured; the adapters below are the seam."""
import logging
import os
import re
from datetime import datetime, time, timedelta

from app import clock, crm_store as db
from app.agents import hub as agents
from app.engine import consent, moments
from app.models.crm import Contact, FactSource, Interaction, Message, ProfileFact, Task

log = logging.getLogger("moldflow.messaging")
AUTO_APPROVE = {"home", "preference", "work"}          # grounded, low-risk facts approve themselves
BOOKING_URL = os.getenv("MOLDFLOW_BOOKING_URL", "https://moldbusters.ca/b")


def booking_link(contact: Contact) -> str:
    return f"{BOOKING_URL}/{contact.id}"


def autonomy_for(msg: Message) -> str:
    """auto | draft | locked. Locked = a human must approve, forever (money, personal facts)."""
    if msg.amount or msg.trigger == "estimate_chase":
        return "locked"
    if msg.facts_used:
        return "locked"
    level = db.autonomy().levels.get(msg.trigger.split(":")[0], "draft")
    return "auto" if level == "auto" else "draft"


def history(contact_id: str) -> list[Message]:
    return db.query(Message, contact_id=contact_id)


def log_interaction(contact: Contact, msg: Message, summary: str) -> None:
    db.put(Interaction(id=db.new_id("i"), contact_id=contact.id, case_id=msg.case_id, at=clock.now(),
                       system=msg.channel, kind=f"{msg.channel}_{msg.direction}", summary=summary, by=msg.approved_by or msg.drafted_by))


def _deliver(msg: Message) -> None:
    """Adapter seam. Real Twilio/Resend calls go here behind TWILIO_*/RESEND_API_KEY; today everything is simulated."""
    msg.status, msg.sent_at = "sent_simulated", clock.now()


def send(msg: Message, by: str) -> Message:
    contact = db.get(Contact, msg.contact_id)
    settings = db.autonomy()
    if settings.paused:
        msg.status, msg.blocked_reason = "draft", "All outbound paused (kill switch)"
        db.put(msg)
        return msg
    ident = (contact.phones or [""])[0] if msg.channel == "sms" else (contact.emails or [""])[0]
    decision, reason = consent.check(contact, msg, history(contact.id), db.is_suppressed(msg.channel, consent.ident_hash(ident)))
    body = msg.body.replace("{booking_link}", booking_link(contact))
    msg.final_body = body + (" " if msg.channel == "sms" else "") + consent.footer(msg, ai_sent=msg.drafted_by != "staff")
    msg.approved_by = msg.approved_by or by
    if decision == "block":
        msg.status, msg.blocked_reason = "blocked", reason
        db.audit("system", "blocked", msg.id, reason)
    elif decision == "hold":
        msg.status, msg.blocked_reason = "approved", reason
    else:
        _deliver(msg)
        msg.blocked_reason = None
        log_interaction(contact, msg, f"{'SMS' if msg.channel == 'sms' else 'Email'} sent ({msg.trigger}): {body[:140]}")
        db.audit(by, "sent", msg.id, f"{msg.trigger} to {contact.name}")
    db.put(msg)
    return msg


def create(contact: Contact, *, trigger: str, body: str, reason: str, drafted_by: str, channel: str | None = None,
           subject: str | None = None, case_id: str | None = None, trigger_ref: str | None = None, facts_used: list[str] | None = None,
           is_cem: bool = True, amount: float | None = None, in_reply_to: str | None = None, tier: str | None = None) -> Message:
    msg = Message(id=db.new_id("msg"), contact_id=contact.id, case_id=case_id, channel=channel or contact.prefs.channel, subject=subject,
                  body=body, language=contact.language, trigger=trigger, trigger_ref=trigger_ref, is_cem=is_cem, facts_used=facts_used or [],
                  reason=reason, drafted_by=drafted_by, amount=amount, in_reply_to=in_reply_to, tier=tier)
    msg.autonomy = autonomy_for(msg)
    human_owned = contact.owner.startswith("human")
    if msg.autonomy == "auto" and not human_owned and drafted_by != "staff":
        return send(msg, by="ai")
    db.put(msg)
    db.audit(drafted_by, "drafted", msg.id, f"{trigger} for {contact.name}")
    return msg


def recompute_moments(contact: Contact) -> None:
    from app.models.crm import Moment
    current = {m.id: m for m in db.query(Moment, contact_id=contact.id)}
    for m in moments.compute(contact, db.query(ProfileFact, contact_id=contact.id), db.query(Interaction, contact_id=contact.id)):
        if m.id not in current or current[m.id].status == "upcoming":
            db.put(m)


def save_facts(contact: Contact, drafts, kind: str, ref: str, by: str, recording_disclosed: bool = True) -> list[ProfileFact]:
    out = []
    existing = {f.text.lower() for f in db.query(ProfileFact, contact_id=contact.id)}
    for d in drafts:
        if d.text.lower() in existing:
            continue
        auto = d.category in AUTO_APPROVE and d.confidence >= 0.7
        f = ProfileFact(id=db.new_id("f"), contact_id=contact.id, text=d.text, category=d.category, confidence=d.confidence,
                        source=FactSource(kind=kind, ref=ref, quote=d.quote, recording_disclosed=recording_disclosed),
                        status="approved" if auto else "pending", message_use="light" if d.category in ("home", "preference", "life_event") else "never",
                        follow_up=agents.to_follow_up(d.follow_up_month), follow_up_reason=d.follow_up_reason,
                        expires_at=clock.today() + timedelta(days=3 * 365), extracted_by="ai" if by == "ai" else "rule")
        out.append(f)
        db.audit(by, "fact_extracted", f.id, f"{f.status}: {f.text}")
    if out:
        db.put(*out)
        recompute_moments(contact)
    return out


def open_estimate(contact: Contact) -> Interaction | None:
    return next((i for i in db.query(Interaction, contact_id=contact.id) if i.kind == "estimate" and i.meta.get("status") in ("viewed", "sent")
                 and i.at.date() + timedelta(days=60) >= clock.today()), None)


async def receive(contact: Contact, channel: str, body: str) -> dict:
    """An inbound SMS/email. Returns what happened (for the UI and tests)."""
    inbound = Message(id=db.new_id("msg"), contact_id=contact.id, channel=channel, direction="in", body=body, language=contact.language,
                      trigger="inbound", status="received", drafted_by="staff", is_cem=False)
    db.put(inbound)
    db.put(Interaction(id=db.new_id("i"), contact_id=contact.id, at=clock.now(), system=channel, kind=f"{channel}_in", summary=f"Customer: {body[:160]}"))
    result: dict = {"inbound_id": inbound.id, "facts": [], "reply": None, "keyword": None}
    kw = consent.keyword(body)
    if kw == "stop":
        ident = (contact.phones or [""])[0] if channel == "sms" else (contact.emails or [""])[0]
        db.suppress(channel, consent.ident_hash(ident), clock.now().isoformat())
        getattr(contact.consent, channel).opt_out_at = clock.now()
        db.put(contact)
        db.audit("customer", "opted_out", contact.id, channel)
        result["keyword"] = "stop"
        return result
    if kw == "human":
        contact.owner = "human:support"
        db.put(contact, Task(id=db.new_id("t"), kind="call_back", title=f"{contact.name} asked for a person", contact_id=contact.id, due=clock.today()))
        result["keyword"] = "human"
        return result
    est = open_estimate(contact)
    est_ctx = {"number": est.meta.get("number"), "total": f"${est.amount:,.2f}"} if est else None
    from app import store as case_store
    case = case_store.get(contact.case_ids[0]) if contact.case_ids else None
    tri, by = await agents.triage(contact, body, est_ctx, case)
    facts, fby = await agents.extract_facts(body, channel)
    result["facts"] = [f.model_dump() for f in save_facts(contact, facts, channel, inbound.id, fby)]
    result["intent"], result["triage_by"] = tri.intent, by
    if tri.intent == "estimate_yes" and est:
        est.meta = {**est.meta, "status": "accepted", "accepted_via": "reply", "accepted_at": clock.now().isoformat()}
        db.put(est, Task(id=db.new_id("t"), kind="crew_schedule", title=f"Schedule remediation crew for {contact.name} ({est.meta.get('number')})",
                         contact_id=contact.id, case_id=est.case_id, due=clock.today() + timedelta(days=2)))
        db.kv_set("recovered", (db.kv_get("recovered", []) or []) + [{"contact_id": contact.id, "amount": est.amount, "number": est.meta.get("number"),
                                                                      "at": clock.now().isoformat()}])
        from app.models.crm import Moment
        for m in db.query(Moment, contact_id=contact.id, status="upcoming"):
            if m.kind == "estimate_expiry":
                m.status = "done"
                db.put(m)
        recompute_moments(contact)
        result["accepted"] = {"number": est.meta.get("number"), "amount": est.amount}
    if tri.escalate:
        db.put(Task(id=db.new_id("t"), kind="escalation", title=f"{contact.name}: {body[:60]}", contact_id=contact.id, due=clock.today()))
    # Instant answers (any hour): booking requests, reschedules, thanks, and health questions get a fixed, reviewed reply that
    # sends on its own. Anything else the AI writes waits for a person.
    if tri.intent == "question" and agents.HEALTH.search(body) and not tri.escalate:
        tri = agents._rule_triage(contact, body, None)
        by = "rule"
    trigger = "faq_reply" if tri.intent in ("booking", "reschedule", "thanks") or (tri.intent == "question" and by == "rule" and agents.HEALTH.search(body)) \
        and not tri.escalate else "inbound_reply"
    reply = create(contact, trigger=trigger, body=tri.reply, reason=f"Reply to: \"{body[:80]}\" ({tri.intent})", drafted_by=by, channel=channel,
                   in_reply_to=inbound.id, is_cem=tri.wants_booking or tri.intent == "estimate_yes", case_id=est.case_id if est else None)
    result["reply"] = reply.model_dump(mode="json")
    return result


def at_local(hour: int) -> datetime:
    return datetime.combine(clock.today(), time(hour))


SMS_LIMIT = 320


def trim_sms(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= SMS_LIMIT else text[: text.rfind(" ", 0, SMS_LIMIT - 1)] + "…"
