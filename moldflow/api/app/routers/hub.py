"""Relationship hub API: people, facts, messages, inbound replies, moments, weather alerts, autonomy, search, demo clock."""
import logging
import re
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import clock, crm_store as db, messaging, store as case_store
from app.agents import hub as agents
from app.engine import consent, floods, geo
from app.models.crm import (AlertEvent, AuditEntry, AutonomySettings, Contact, FactEdit, Interaction, Message, Moment, ProfileFact,
                            PropertyRef, Task)

router = APIRouter()
log = logging.getLogger("moldflow.hub")


def _contact(cid: str) -> Contact:
    c = db.get(Contact, cid)
    if not c:
        raise HTTPException(404, "contact not found")
    return c


def consent_badge(c: Contact) -> dict:
    ok, why = consent.consent_ok(getattr(c.consent, c.prefs.channel), clock.today())
    return {"ok": ok, "why": why, "basis": getattr(c.consent, c.prefs.channel).basis}


# ---------------------------------------------------------------- people
class PersonRow(BaseModel):
    id: str
    name: str
    city: str
    language: str
    customer_type: str
    synthetic: bool
    phone: str | None
    open_estimate: float | None
    estimate_status: str | None
    pending_facts: int
    last_contact: str | None
    consent_ok: bool
    owner: str


def person_row(c: Contact) -> PersonRow:
    inter = db.query(Interaction, contact_id=c.id)
    est = next((i for i in inter if i.kind == "estimate"), None)
    if est and est.meta.get("status") in ("sent", "viewed") and est.at.date() + timedelta(days=60) < clock.today():
        est = est.model_copy(update={"meta": {**est.meta, "status": "expired"}})
    return PersonRow(id=c.id, name=c.name, city=(c.properties[0].city if c.properties else ""), language=c.language, customer_type=c.customer_type,
                     synthetic=c.synthetic, phone=(c.phones or [None])[0], open_estimate=est.amount if est and est.meta.get("status") in ("sent", "viewed") else None,
                     estimate_status=est.meta.get("status") if est else None,
                     pending_facts=len(db.query(ProfileFact, contact_id=c.id, status="pending")),
                     last_contact=inter[0].at.date().isoformat() if inter else None, consent_ok=consent_badge(c)["ok"], owner=c.owner)


@router.get("/people")
def people(q: str = "") -> list[PersonRow]:
    return [person_row(c) for c in search_contacts(q)]


def search_contacts(q: str) -> list[Contact]:
    cs = [c for c in db.query(Contact) if not c.merged_into]
    q = q.strip().lower()
    if not q:
        return sorted(cs, key=lambda c: (c.synthetic, c.name))
    digits = re.sub(r"\D", "", q)
    def hit(c: Contact) -> bool:
        hay = " ".join([c.name, *c.emails, *c.case_ids, *[f"{p.address} {p.city} {p.postal}" for p in c.properties]]).lower()
        return q in hay or (len(digits) >= 3 and any(digits in re.sub(r"\D", "", p) for p in c.phones))
    return [c for c in cs if hit(c)]


@router.get("/search")
def search(q: str) -> list[PersonRow]:
    return [person_row(c) for c in search_contacts(q)[:8]]


class PersonView(BaseModel):
    contact: Contact
    facts: list[ProfileFact]
    moments: list[Moment]
    messages: list[Message]
    timeline: list[Interaction]
    tasks: list[Task]
    cases: list[dict]
    consent: dict
    talking_points: list[str]
    talking_points_by: str


@router.get("/people/{cid}")
def person(cid: str) -> PersonView:
    c = _contact(cid)
    facts = db.query(ProfileFact, contact_id=cid)
    inter = sorted(db.query(Interaction, contact_id=cid), key=lambda i: i.at, reverse=True)
    pts = agents._rule_points(c, facts, inter)
    cases = []
    for case_id in c.case_ids:
        if case := case_store.get(case_id):
            cases.append({"id": case.id, "title": case.title, "stage": case.stage, "estimate": float(case.estimate.total) if case.estimate else None,
                          "concern": case.concern[:200]})
    return PersonView(contact=c, facts=sorted(facts, key=lambda f: (f.status != "pending", f.learned_at), reverse=False),
                      moments=sorted([m for m in db.query(Moment, contact_id=cid) if m.status == "upcoming"], key=lambda m: m.due),
                      messages=sorted(db.query(Message, contact_id=cid), key=lambda m: m.created_at, reverse=True), timeline=inter,
                      tasks=[t for t in db.query(Task, contact_id=cid) if t.status == "open"], cases=cases, consent=consent_badge(c),
                      talking_points=pts, talking_points_by="rule")


@router.post("/people/{cid}/talking-points")
async def refresh_points(cid: str) -> dict:
    c = _contact(cid)
    pts, by = await agents.talking_points(c, db.query(ProfileFact, contact_id=cid), sorted(db.query(Interaction, contact_id=cid), key=lambda i: i.at, reverse=True))
    return {"points": pts, "by": by}


class ContactPatch(BaseModel):
    name: str | None = None
    language: str | None = None
    phones: list[str] | None = None
    emails: list[str] | None = None
    channel: str | None = None
    storm_checkin_opt_in: bool | None = None
    personalised_reminders: bool | None = None
    do_not_contact: bool | None = None
    owner: str | None = None
    by: str = "staff"


@router.patch("/people/{cid}")
async def patch_person(cid: str, body: ContactPatch) -> PersonView:
    async with db.write_lock:
        c = _contact(cid)
        for k in ("name", "language", "phones", "emails", "do_not_contact", "owner"):
            if (v := getattr(body, k)) is not None:
                setattr(c, k, v)
        if body.channel:
            c.prefs.channel = body.channel
        if body.storm_checkin_opt_in is not None:
            c.prefs.storm_checkin_opt_in = body.storm_checkin_opt_in
        if body.personalised_reminders is not None:
            c.consent.personalised_reminders = body.personalised_reminders
        db.put(c)
        db.audit(body.by, "edited_contact", cid, body.model_dump_json(exclude_none=True)[:300])
    return person(cid)


class NoteIn(BaseModel):
    text: str
    by: str = "staff"
    kind: str = "note"  # note | call (after-call summary)


@router.post("/people/{cid}/notes")
async def add_note(cid: str, body: NoteIn) -> dict:
    c = _contact(cid)
    db.put(Interaction(id=db.new_id("i"), contact_id=cid, at=clock.now(), system="dialpad" if body.kind == "call" else "moldflow",
                       kind=body.kind, summary=body.text[:300], by=body.by))
    drafts, by = await agents.extract_facts(body.text, body.kind)
    saved = messaging.save_facts(c, drafts, "call" if body.kind == "call" else "note", f"{body.kind} by {body.by}", by)
    return {"facts": saved, "extracted_by": by}


class NewContactIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    postal: str = ""
    city: str = ""
    language: str = "en"


@router.post("/people")
async def new_person(body: NewContactIn) -> Contact:
    fsa = geo.fsa_of(body.postal)
    loc = geo.locate(body.postal)
    c = Contact(id=db.new_id("c-"), name=body.name, phones=[body.phone] if body.phone else [], emails=[body.email] if body.email else [],
                language="fr" if body.language == "fr" else "en",
                properties=[PropertyRef(postal=body.postal, city=body.city, fsa=fsa, lat=loc[0] if loc else None, lon=loc[1] if loc else None,
                                        province="QC" if fsa and fsa[0] in "GHJ" else "ON" if fsa and fsa[0] in "KLMNP" else "unknown")])
    db.put(c)
    return c


# ---------------------------------------------------------------- facts
class FactPatch(BaseModel):
    text: str | None = None
    category: str | None = None
    message_use: str | None = None
    by: str = "staff"


def _fact(fid: str) -> ProfileFact:
    f = db.get(ProfileFact, fid)
    if not f:
        raise HTTPException(404, "fact not found")
    return f


@router.post("/facts/{fid}/approve")
async def approve_fact(fid: str, by: str = "staff") -> ProfileFact:
    f = _fact(fid)
    f.status = "approved"
    db.put(f)
    db.audit(by, "fact_approved", fid, f.text)
    messaging.recompute_moments(_contact(f.contact_id))
    return f


@router.post("/facts/{fid}/reject")
async def reject_fact(fid: str, by: str = "staff") -> dict:
    f = _fact(fid)
    db.delete(ProfileFact, fid)  # rejected facts are deleted, not hidden (data minimisation)
    db.audit(by, "fact_rejected_deleted", fid, f.text)
    return {"deleted": fid}


@router.patch("/facts/{fid}")
async def edit_fact(fid: str, body: FactPatch) -> ProfileFact:
    f = _fact(fid)
    if body.text and body.text != f.text:
        f.edits.append(FactEdit(by=body.by, before=f.text, after=body.text))
        f.text = body.text
    if body.category:
        f.category = body.category
    if body.message_use:
        f.message_use = body.message_use
    f = ProfileFact.model_validate(f.model_dump())  # re-run the health guard
    db.put(f)
    db.audit(body.by, "fact_edited", fid, f.text)
    return f


@router.post("/facts/approve-safe")
async def approve_safe(by: str = "staff") -> dict:
    n = 0
    for f in db.query(ProfileFact, status="pending"):
        if f.category in ("home", "preference", "work", "life_event") and f.confidence >= 0.7:
            f.status = "approved"
            db.put(f)
            n += 1
    db.audit(by, "facts_approved_safe", "*", str(n))
    return {"approved": n}


# ---------------------------------------------------------------- messages
class MessageRow(BaseModel):
    message: Message
    contact_name: str
    contact_synthetic: bool


@router.get("/messages")
def messages(status: str = "draft") -> list[MessageRow]:
    names = {c.id: c for c in db.query(Contact)}
    rows = db.query(Message, status=status.split(","))
    return [MessageRow(message=m, contact_name=names[m.contact_id].name if m.contact_id in names else "?",
                       contact_synthetic=names[m.contact_id].synthetic if m.contact_id in names else False)
            for m in sorted(rows, key=lambda m: m.created_at, reverse=True)]


class ApproveIn(BaseModel):
    by: str = "staff"
    body: str | None = None


@router.post("/messages/{mid}/approve")
async def approve_message(mid: str, body: ApproveIn) -> Message:
    async with db.write_lock:
        m = db.get(Message, mid)
        if not m:
            raise HTTPException(404, "message not found")
        if body.body and body.body != m.body:
            db.audit(body.by, "edited_draft", mid, f"{m.body[:120]} -> {body.body[:120]}")
            m.body = body.body
        m.approved_by = body.by
        return messaging.send(m, body.by)


class BatchIn(BaseModel):
    ids: list[str]
    by: str = "staff"


@router.post("/messages/approve-batch")
async def approve_batch(body: BatchIn) -> dict:
    out = {"sent": 0, "blocked": 0, "held": 0}
    async with db.write_lock:
        for mid in body.ids:
            m = db.get(Message, mid)
            if not m or m.status != "draft":
                continue
            m.approved_by = body.by
            m = messaging.send(m, body.by)
            out["sent" if m.status == "sent_simulated" else "blocked" if m.status == "blocked" else "held"] += 1
    return out


@router.post("/messages/{mid}/discard")
async def discard_message(mid: str, by: str = "staff") -> dict:
    db.delete(Message, mid)
    db.audit(by, "discarded_draft", mid)
    return {"deleted": mid}


class ManualIn(BaseModel):
    body: str
    channel: str = "sms"
    by: str = "staff"
    marketing: bool = False


@router.post("/people/{cid}/messages")
async def manual_message(cid: str, body: ManualIn) -> Message:
    """A staff member writes to the customer: also goes through consent, and takes the thread over from the AI."""
    c = _contact(cid)
    if not c.owner.startswith("human"):
        c.owner = f"human:{body.by}"
        db.put(c)
    m = messaging.create(c, trigger="manual", body=body.body, reason="written by staff", drafted_by="staff", channel=body.channel, is_cem=body.marketing)
    return messaging.send(m, body.by)


class InboundIn(BaseModel):
    contact_id: str | None = None
    from_: str | None = None
    channel: str = "sms"
    body: str
    name: str | None = None


@router.post("/webhooks/inbound")
async def inbound(body: InboundIn) -> dict:
    """Simulated Twilio/Resend inbound webhook. Unknown numbers become new contacts (texting us = an inquiry: 6 months of
    implied consent under CASL s.10(9)(b))."""
    c = db.get(Contact, body.contact_id) if body.contact_id else None
    if not c and body.from_:
        digits = re.sub(r"\D", "", body.from_)
        c = next((x for x in db.query(Contact) if any(digits[-7:] in re.sub(r"\D", "", p) for p in x.phones)), None)
        if not c:
            from app.models.crm import ChannelConsent
            today = clock.today()
            c = Contact(id=db.new_id("c-"), name=body.name or f"New lead {body.from_}", phones=[body.from_] if body.channel == "sms" else [],
                        emails=[body.from_] if body.channel == "email" else [], tags=["new lead"])
            inquiry = ChannelConsent(basis="implied_inquiry", granted_at=today, implied_until=consent.implied_until("implied_inquiry", today),
                                     granted_via="reply", evidence_ref=f"inbound {body.channel} {clock.now().isoformat()}")
            c.consent.sms, c.consent.email = inquiry, inquiry.model_copy()
            db.put(c)
    if not c:
        raise HTTPException(422, "Give contact_id or from_")
    out = await messaging.receive(c, body.channel, body.body)
    out["contact_id"] = c.id
    return out


@router.post("/people/{cid}/chase")
async def chase(cid: str) -> Message:
    """Draft the estimate follow-up that answers the customer's own question (locked: a human approves anything with $)."""
    c = _contact(cid)
    est = messaging.open_estimate(c)
    if not est:
        raise HTTPException(404, "No open estimate for this person.")
    case = case_store.get(est.case_id) if est.case_id else None
    concern, sources = agents.concern_and_sources(case)
    if not concern:
        concern = next((i.summary.replace("Inbound call: ", "") for i in db.query(Interaction, contact_id=cid) if i.kind == "call"), "")
    valid = (est.at.date() + timedelta(days=60)).isoformat()
    ctx = {"number": est.meta.get("number"), "total": f"${est.amount:,.2f}", "valid_until": valid, "status": est.meta.get("status"),
           "concern": concern, "sources": sources}
    d, by = await agents.draft(c, "estimate_chase", ctx, db.query(ProfileFact, contact_id=cid), c.prefs.channel)
    return messaging.create(c, trigger="estimate_chase", body=messaging.trim_sms(d.body) if c.prefs.channel == "sms" else d.body,
                            subject=d.subject, reason=d.reason, drafted_by=by, case_id=est.case_id, facts_used=d.facts_used,
                            amount=est.amount, trigger_ref=est.id)


# ---------------------------------------------------------------- moments
class MomentRow(BaseModel):
    moment: Moment
    contact_name: str
    language: str


@router.get("/moments")
def list_moments(days: int = 120) -> list[MomentRow]:
    names = {c.id: c for c in db.query(Contact)}
    horizon = clock.today() + timedelta(days=days)
    ms = [m for m in db.query(Moment, status="upcoming") if m.due <= horizon]
    return [MomentRow(moment=m, contact_name=names[m.contact_id].name, language=names[m.contact_id].language) for m in sorted(ms, key=lambda m: m.due)
            if m.contact_id in names]


@router.post("/moments/run")
async def run_moments() -> dict:
    n = 0
    for c in db.query(Contact):
        messaging.recompute_moments(c)
        n += 1
    return {"contacts": n, "moments": len(db.query(Moment, status="upcoming"))}


@router.post("/moments/{mid}/draft")
async def draft_moment(mid: str) -> dict:
    m = db.get(Moment, mid)
    if not m:
        raise HTTPException(404, "moment not found")
    c = _contact(m.contact_id)
    if m.human_only:
        t = Task(id=db.new_id("t"), kind="call_back", title=f"Call {c.name}: {m.reason}", contact_id=c.id, due=m.due)
        m.status = "drafted"
        db.put(t, m)
        return {"task": t.model_dump(mode="json"), "note": "Household moments are for a person to bring up on a call, not an automated message."}
    if m.kind == "estimate_expiry":
        msg = await chase(c.id)
    else:
        facts = db.query(ProfileFact, contact_id=c.id)
        d, by = await agents.draft(c, f"moment:{m.kind}", {"reason": m.reason, "fact_id": m.source_fact_id}, facts, c.prefs.channel)
        msg = messaging.create(c, trigger=f"moment:{m.kind}", body=messaging.trim_sms(d.body), subject=d.subject, reason=d.reason, drafted_by=by,
                               facts_used=[f"life:{x}" if (f := next((y for y in facts if y.id == x), None)) and f.category == "life_event" else x for x in d.facts_used],
                               trigger_ref=m.id, case_id=m.case_id)
    m.status = "drafted"
    db.put(m)
    return {"message": msg.model_dump(mode="json")}


# ---------------------------------------------------------------- weather alerts
class AlertView(BaseModel):
    alert: AlertEvent
    matched: list[dict]


def _views() -> list[AlertView]:
    names = {c.id: c for c in db.query(Contact)}
    out = []
    for a in sorted(db.query(AlertEvent, status="active"), key=lambda a: a.fetched_at, reverse=True):
        rows = []
        for mt in a.matches:
            c = names.get(mt.contact_id)
            if not c:
                continue
            ok, why = consent.consent_ok(getattr(c.consent, c.prefs.channel), clock.today())
            rows.append({"contact_id": c.id, "name": c.name, "priority": mt.priority, "reason": mt.reason, "language": c.language,
                         "marketing_ok": ok, "consent": why, "synthetic": c.synthetic})
        out.append(AlertView(alert=a, matched=rows))
    return out


@router.get("/alerts")
def alerts() -> list[AlertView]:
    return _views()


def _store_alert(a: AlertEvent) -> AlertEvent:
    contacts = db.query(Contact)
    facts = {c.id: db.query(ProfileFact, contact_id=c.id) for c in contacts}
    inter = {c.id: db.query(Interaction, contact_id=c.id) for c in contacts}
    a.matches = floods.match(a, contacts, facts, inter)
    db.put(a)
    db.audit("system", "alert", a.id, f"{a.type} {a.area}: {len(a.matches)} matches")
    return a


@router.post("/alerts/poll")
async def poll_alerts() -> dict:
    if not floods.live_allowed():
        return {"live": False, "reason": "fixture/e2e mode: live alerts disabled", "new": 0}
    try:
        live = await floods.fetch_live()
    except Exception as e:  # network down: keep whatever we had
        return {"live": False, "reason": f"Environment Canada unreachable: {type(e).__name__}", "new": 0}
    known = {a.id for a in db.query(AlertEvent)}
    new = [_store_alert(a) for a in live if a.id not in known]
    db.kv_set("alerts_polled_at", clock.now().isoformat())
    return {"live": True, "water_alerts_in_on_qc": len(live), "new": len(new), "matched": sum(len(a.matches) for a in new)}


class SimIn(BaseModel):
    zone: str = "Gatineau"


@router.post("/alerts/simulate")
async def simulate_alert(body: SimIn) -> AlertView:
    if body.zone not in geo.zones():
        raise HTTPException(422, f"zone must be one of {sorted(geo.zones())}")
    a = _store_alert(floods.simulated(body.zone))
    return next(v for v in _views() if v.alert.id == a.id)


@router.post("/alerts/{aid}/draft")
async def draft_checkins(aid: str) -> dict:
    """One draft per matched person: the offer version only where marketing consent is valid; otherwise a safety-only
    message (no link, no offer: not a commercial message), and nothing for people who opted out."""
    a = db.get(AlertEvent, aid)
    if not a:
        raise HTTPException(404, "alert not found")
    made = {"offer": 0, "safety": 0, "skipped": 0}
    existing = {(m.contact_id, m.trigger_ref) for m in db.query(Message) if m.trigger.startswith("storm")}
    for mt in a.matches:
        c = db.get(Contact, mt.contact_id)
        if not c or (c.id, a.id) in existing:
            made["skipped"] += 1
            continue
        ch = getattr(c.consent, c.prefs.channel)
        if ch.opt_out_at or c.do_not_contact:
            made["skipped"] += 1
            continue
        ok, _ = consent.consent_ok(ch, clock.today())
        variant = "storm_offer" if ok and mt.priority <= 2 else "storm_safety"
        if variant == "storm_safety" and mt.priority == 3:
            made["skipped"] += 1  # people in the area without consent or water history get nothing
            continue
        area = a.area if c.language == "en" else geo.zones().get(a.area, {}).get("props", {}).get("NOM", a.area)
        d, by = await agents.draft(c, variant, {"area": area, "alert": a.type}, db.query(ProfileFact, contact_id=c.id), c.prefs.channel)
        messaging.create(c, trigger=variant, body=messaging.trim_sms(d.body), subject=d.subject, reason=f"{d.reason} · {mt.reason}", drafted_by=by,
                         trigger_ref=a.id, is_cem=variant == "storm_offer", facts_used=d.facts_used)
        made["offer" if variant == "storm_offer" else "safety"] += 1
    return made


# ---------------------------------------------------------------- tasks, autonomy, clock, audit
@router.get("/tasks")
def tasks() -> list[Task]:
    return sorted([t for t in db.query(Task) if t.status == "open"], key=lambda t: (t.due or date.max))


@router.post("/tasks/{tid}/done")
async def task_done(tid: str, by: str = "staff") -> Task:
    t = db.get(Task, tid)
    if not t:
        raise HTTPException(404)
    t.status = "done"
    db.put(t)
    db.audit(by, "task_done", tid, t.title)
    return t


@router.get("/settings/autonomy")
def get_autonomy() -> AutonomySettings:
    return db.autonomy()


@router.put("/settings/autonomy")
async def put_autonomy(body: AutonomySettings, by: str = "owner") -> AutonomySettings:
    db.save_autonomy(body)
    db.audit(by, "autonomy_changed", "settings", body.model_dump_json()[:300])
    return body


class PauseIn(BaseModel):
    paused: bool
    by: str = "owner"


@router.post("/settings/pause")
async def pause(body: PauseIn) -> AutonomySettings:
    a = db.autonomy()
    a.paused = body.paused
    db.save_autonomy(a)
    db.audit(body.by, "kill_switch", "settings", "paused" if body.paused else "resumed")
    return a


class ClockIn(BaseModel):
    today: date | None = None


@router.get("/admin/clock")
def get_clock() -> dict:
    return {"today": clock.today().isoformat(), "travelling": clock.is_travelling()}


@router.post("/admin/clock")
async def set_clock(body: ClockIn) -> dict:
    clock.set_today(body.today)
    await run_moments()
    return get_clock()


@router.get("/audit")
def audit(limit: int = 50) -> list[AuditEntry]:
    return sorted(db.query(AuditEntry), key=lambda a: a.at, reverse=True)[:limit]


# ---------------------------------------------------------------- the hub
@router.get("/hub")
def hub() -> dict:
    today = clock.today()
    contacts = {c.id: c for c in db.query(Contact)}
    drafts = db.query(Message, status="draft")
    blocked = db.query(Message, status="blocked")
    held = [m for m in db.query(Message, status="approved") if m.blocked_reason]
    sent = db.query(Message, status="sent_simulated")
    pending_facts = db.query(ProfileFact, status="pending")
    open_tasks = [t for t in db.query(Task) if t.status == "open"]
    ests = [i for i in db.query(Interaction) if i.kind == "estimate"]
    open_est = [i for i in ests if i.meta.get("status") in ("sent", "viewed") and i.at.date() + timedelta(days=60) >= today]
    at_risk = sorted([i for i in open_est if i.meta.get("status") == "viewed"], key=lambda i: i.at)
    chased = {m.trigger_ref for m in sent if m.trigger == "estimate_chase"}
    recovered = db.kv_get("recovered", []) or []
    inbound = [m for m in db.query(Message, status="received")]
    replied_contacts = {m.contact_id for m in inbound}
    week = today - timedelta(days=7)
    auto_sent = [m for m in sent if m.approved_by == "ai" and m.sent_at and m.sent_at.date() >= week]
    human_sent = [m for m in sent if m.approved_by not in ("ai", None) and m.sent_at and m.sent_at.date() >= week]
    edited = len([a for a in db.query(AuditEntry) if a.action == "edited_draft" and a.at.date() >= week])
    bookings = []
    for case in case_store.list_all():
        b = case.booking
        if b and b.slot_date == today:
            bookings.append({"case_id": case.id, "time": b.slot_time, "name": b.contact.name if b.contact else case.customer.alias,
                             "concern": case.concern[:90], "address": case.property.region_text})
    upcoming = sorted([m for m in db.query(Moment, status="upcoming") if m.due <= today + timedelta(days=60)], key=lambda m: m.due)
    alerts_v = [v for v in _views() if v.matched]
    threads = []
    for m in sorted(inbound, key=lambda m: m.created_at, reverse=True)[:8]:
        c = contacts.get(m.contact_id)
        reply = next((x for x in drafts if x.in_reply_to == m.id), None)
        threads.append({"contact_id": m.contact_id, "name": c.name if c else "?", "body": m.body, "at": m.created_at.isoformat(),
                        "owner": c.owner if c else "ai", "reply_draft_id": reply.id if reply else None})
    return {
        "today": today.isoformat(), "clock_travelling": clock.is_travelling(), "paused": db.autonomy().paused,
        "needs_you": {"drafts": len(drafts), "locked_drafts": len([m for m in drafts if m.autonomy == "locked"]), "pending_facts": len(pending_facts),
                      "escalations": len([t for t in open_tasks if t.kind == "escalation"]), "callbacks": len([t for t in open_tasks if t.kind == "call_back"]),
                      "blocked": len(blocked), "held": len(held), "tasks": [t.model_dump(mode="json") for t in open_tasks[:6]]},
        "alerts": [{"id": v.alert.id, "type": v.alert.type, "area": v.alert.area, "source": v.alert.source, "matches": len(v.matched),
                    "opted_in": len([x for x in v.matched if x["priority"] == 1]),
                    "drafted": len([m for m in drafts if m.trigger_ref == v.alert.id])} for v in alerts_v],
        "today_jobs": bookings,
        "inbound": threads,
        "money": {
            "open_estimates_total": round(sum(i.amount or 0 for i in open_est), 2), "open_estimates": len(open_est),
            "at_risk": [{"contact_id": i.contact_id, "name": contacts[i.contact_id].name if i.contact_id in contacts else "?",
                         "number": i.meta.get("number"), "amount": i.amount, "status": i.meta.get("status"),
                         "days_since": (today - i.at.date()).days, "expires": (i.at.date() + timedelta(days=60)).isoformat(),
                         "chased": i.id in chased} for i in at_risk[:6]],
            "funnel": {"chased": len(chased), "replied": len([c for c in replied_contacts if any(i.contact_id == c for i in ests)]),
                       "accepted": len(recovered)},
            "recovered_total": round(sum(r["amount"] or 0 for r in recovered), 2), "recovered": recovered[-5:],
        },
        "autonomy": {"auto_sent_7d": len(auto_sent), "approved_sent_7d": len(human_sent), "edited_7d": edited, "blocked_total": len(blocked)},
        "moments": [{"id": m.id, "contact_id": m.contact_id, "name": contacts[m.contact_id].name if m.contact_id in contacts else "?",
                     "kind": m.kind, "due": m.due.isoformat(), "reason": m.reason, "human_only": m.human_only} for m in upcoming[:8]],
        "counts": {"contacts": len(contacts), "synthetic": len([c for c in contacts.values() if c.synthetic]),
                   "tools_unified": sorted({i.system for i in db.query(Interaction)})},
    }
