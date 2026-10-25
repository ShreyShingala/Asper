"""People overview (map + all-customers dashboard), the follow-up queue, and the demo texting sandbox."""
import re
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import clock, crm_store as db, messaging, store
from app.models.crm import Contact, Message, Moment, ProfileFact

router = APIRouter()


def _person(c: Contact) -> dict:
    case = store.get(c.case_ids[0]) if c.case_ids else None
    msgs = sorted([m for m in db.query(Message, contact_id=c.id) if m.status in ("received", "sent_simulated", "draft")], key=lambda m: m.created_at)
    facts = db.query(ProfileFact, contact_id=c.id)
    fus = sorted([m for m in db.query(Moment, contact_id=c.id)], key=lambda m: m.due)
    p = c.properties[0] if c.properties else None
    return {
        "id": c.id, "name": c.name, "language": c.language, "type": c.customer_type, "synthetic": c.synthetic, "owner": c.owner,
        "phone": (c.phones or [""])[0], "email": (c.emails or [""])[0],
        "address": f"{p.address}, {p.city}" if p and p.address else (p.city if p else ""), "postal": p.postal if p else "",
        "lat": p.lat if p else None, "lon": p.lon if p else None,
        "case": {"id": case.id, "title": case.title, "stage": case.stage, "concern": case.concern, "project_no": case.project_no,
                 "photos": [x.id for x in case.photos][:6], "photo_count": len(case.photos), "findings": len(case.findings),
                 "service": case.pre_assessment.service_price_text if case.pre_assessment else None,
                 "visit": case.booking.slot_text if case.booking and case.booking.slot_date else None,
                 "estimate": f"{case.estimate.id} · ${case.estimate.total:,.2f} · {case.estimate.status}" if case.estimate else None,
                 "paid": [x.product for x in case.payments]} if case else None,
        "messages": [{"id": m.id, "dir": m.direction, "text": m.body, "at": m.created_at.isoformat(), "status": m.status} for m in msgs][-12:],
        "drafts": sum(1 for m in msgs if m.status == "draft"),
        "facts": [{"id": f.id, "text": f.text, "category": f.category, "status": f.status, "quote": f.source.quote, "learned": f.learned_at.isoformat()}
                  for f in sorted(facts, key=lambda f: f.learned_at, reverse=True)],
        "followups": [{"id": m.id, "due": m.due.isoformat(), "reason": m.reason, "status": m.status} for m in fus],
        "last_at": msgs[-1].created_at.isoformat() if msgs else None,
    }


@router.get("/people/overview")
def people_overview() -> dict:
    people = [_person(c) for c in db.query(Contact)]
    return {"today": clock.today().isoformat(), "people": sorted(people, key=lambda p: p["last_at"] or "", reverse=True)}


@router.get("/followups")
def followup_queue() -> dict:
    names = {c.id: c.name for c in db.query(Contact)}
    today = clock.today()
    rows = [{"id": m.id, "contact_id": m.contact_id, "name": names.get(m.contact_id, "?"), "due": m.due.isoformat(), "reason": m.reason,
             "status": m.status, "kind": m.kind, "overdue": m.due <= today and m.status == "upcoming", "case_id": m.case_id}
            for m in db.query(Moment) if m.kind in ("fact_follow_up", "estimate_expiry", "post_remediation_check") and not m.human_only]
    return {"today": today.isoformat(), "queue": sorted(rows, key=lambda r: (r["status"] != "upcoming", r["due"]))}


def _followup_text(c: Contact, m: Moment) -> str:
    first = c.name.split()[0] if not c.name.startswith("Sample") else ""
    fr = c.language == "fr"
    hi = (f"Bonjour {first}, " if first else "Bonjour, ") if fr else (f"Hi {first}, " if first else "Hi, ")
    why = m.reason.rstrip(".")
    return (f"{hi}petit suivi comme promis ({why.lower()}). Comment ça va de votre côté? Répondez ici, on s'en occupe."
            if fr else f"{hi}following up as promised: {why[0].lower() + why[1:]}. How are things on your end? Just reply here.")


def run_due() -> list[dict]:
    """When a follow-up's time comes, the system sends it (routine reminder: auto) and logs it on the person."""
    fired, today = [], clock.today()
    for m in db.query(Moment, status="upcoming"):
        if m.due > today or m.human_only or m.kind not in ("fact_follow_up", "estimate_expiry", "post_remediation_check"):
            continue
        c = db.get(Contact, m.contact_id)
        if not c:
            continue
        msg = messaging.create(c, trigger="reminder", body=_followup_text(c, m), reason=f"Scheduled follow-up: {m.reason}",
                               drafted_by="rule", case_id=m.case_id, is_cem=False)
        m.status = "done" if msg.status == "sent_simulated" else "drafted"
        db.put(m)
        fired.append({"moment": m.id, "name": c.name, "status": msg.status, "body": msg.final_body or msg.body})
    return fired


@router.post("/followups/run")
def followups_run() -> dict:
    return {"today": clock.today().isoformat(), "fired": run_due()}


WHEN = [(r"\btomorrow\b|\bdemain\b", 1), (r"\bnext week\b|\bsemaine prochaine\b", 7), (r"\bin (\d+) days?\b|\bdans (\d+) jours?\b", None),
        (r"\bin (\d+) weeks?\b|\bdans (\d+) semaines?\b", "w"), (r"\bnext month\b|\bmois prochain\b", 30),
        (r"\bafter the holidays\b", 21), (r"\b(call|text|check (in|back)|follow up|remind) (me|with me)?\b.*\blater\b", 3)]


def schedule_from_text(c: Contact, text: str, case_id: str | None) -> Moment | None:
    """'Text me next week' / 'call me back in 3 days' -> a follow-up in the queue."""
    if not re.search(r"\b(call|text|contact|remind|check|follow|reach|get back|rappel|écri|text)\w*", text, re.I):
        return None
    for rx, days in WHEN:
        if mm := re.search(rx, text, re.I):
            n = next((int(g) for g in mm.groups() if g and g.isdigit()), None) if mm.groups() else None
            d = (n * 7 if days == "w" else n) if days in (None, "w") and n else (days if isinstance(days, int) else 3)
            m = Moment(id=db.new_id("m-"), contact_id=c.id, kind="fact_follow_up", due=clock.today() + timedelta(days=d), case_id=case_id,
                       reason=f"They asked: \"{text[:80]}\"")
            db.put(m)
            return m
    return None


class TextIn(BaseModel):
    contact_id: str
    body: str


@router.post("/demo/text")
async def demo_text(body: TextIn) -> dict:
    """Pretend to be the customer: the text goes through the real inbound pipeline (AI/rule reply, fact learning) and any
    'get back to me' request becomes a scheduled follow-up."""
    c = db.get(Contact, body.contact_id)
    if not c or not body.body.strip():
        raise HTTPException(404, "Pick a customer and type a message.")
    res = await messaging.receive(c, "sms", body.body.strip())
    fu = schedule_from_text(c, body.body, c.case_ids[0] if c.case_ids else None)
    return {**res, "followup": {"id": fu.id, "due": fu.due.isoformat(), "reason": fu.reason} if fu else None, "person": _person(db.get(Contact, c.id))}


class AdvanceIn(BaseModel):
    days: int = 1


@router.post("/demo/advance")
def demo_advance(body: AdvanceIn) -> dict:
    """Move the demo clock forward and let due follow-ups fire."""
    clock.set_today(clock.today() + timedelta(days=max(1, min(body.days, 90))))
    return {"today": clock.today().isoformat(), "fired": run_due()}
