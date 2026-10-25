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
    msgs = sorted([m for m in db.query(Message, contact_id=c.id) if m.status in ("received", "sent_simulated", "approved", "draft")], key=lambda m: m.created_at)
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
        "messages": [{"id": m.id, "dir": m.direction, "text": (m.final_body or m.body).replace("{booking_link}", messaging.booking_link(c, m.id)), "at": m.created_at.isoformat(), "status": m.status} for m in msgs][-12:],
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


PERSONAL = [  # (fact pattern, EN offer, FR offer): proactive, personal, always drafted for approval
    (r"baby|pregnan|expecting|nursery", "I remember you mentioned the new baby on the way, congratulations! We'd love to do a free home check so the nursery and bedrooms are as safe as possible for them.",
     "Je me souviens que vous attendez un bébé, félicitations! Nous aimerions faire une vérification gratuite pour que la chambre du bébé soit la plus saine possible."),
    (r"sell|listing|closing|buyers", "You mentioned you're selling: want a quick pre-listing moisture check so nothing surprises the buyers' inspector?",
     "Vous avez mentionné la vente de la maison: voulez-vous une vérification d'humidité avant la mise en vente?"),
    (r"renovat|finish(ing)? the basement|drywall", "You mentioned the renovation: a moisture check before the drywall goes up is the cheapest time to catch a problem.",
     "Vous avez parlé de rénovations: une vérification d'humidité avant de fermer les murs est le meilleur moment."),
    (r"asthma|allerg|cough|headache", "How is everyone feeling? If the air still bothers you, an air quality test can check what photos can't.",
     "Comment allez-vous? Si l'air vous dérange encore, un test de qualité de l'air peut vérifier ce que les photos ne montrent pas."),
]


class ProactiveIn(BaseModel):
    contact_id: str


@router.post("/proactive/draft")
def proactive_draft(body: ProactiveIn) -> dict:
    """A personal check-in from what we remember about the person. Uses personal facts, so it is always locked for approval."""
    c = db.get(Contact, body.contact_id)
    if not c:
        raise HTTPException(404, "Unknown customer.")
    facts = sorted(db.query(ProfileFact, contact_id=c.id), key=lambda f: f.learned_at, reverse=True)
    for f in facts:
        for rx, en, fr in PERSONAL:
            if re.search(rx, f"{f.text} {f.source.quote}", re.I):
                first = "" if c.name.startswith(("Kanata", "Montreal", "Smiths", "Pembroke", "Stittsville", "Client")) else c.name.split()[0] + ", "
                text = f"{'Bonjour' if c.language == 'fr' else 'Hi'} {first.rstrip(', ')}".strip() + ", " + (fr if c.language == "fr" else en) + " {booking_link}"
                msg = messaging.create(c, trigger="moment:personal", body=text, reason=f"Proactive: remembered \"{f.source.quote[:70]}\"",
                                       drafted_by="rule", case_id=c.case_ids[0] if c.case_ids else None, facts_used=[f.id], is_cem=True)
                return {"message": msg.model_dump(mode="json"), "fact": f.text}
    raise HTTPException(422, "Nothing personal to follow up on yet: text a life event (baby, selling, renovation) first.")


@router.post("/messages/{mid}/deny-draft")
def deny_draft(mid: str) -> dict:
    m = db.get(Message, mid)
    if not m or m.status != "draft":
        raise HTTPException(404, "No draft.")
    m.status, m.blocked_reason = "blocked", "Denied by owner"
    db.put(m)
    return {"ok": True}


# ---------------------------------------------------------------- on-site walkthrough video -> report
from fastapi import File, UploadFile  # noqa: E402

from app import config  # noqa: E402

@router.post("/onsite/video")
async def onsite_video(video: UploadFile = File(...)) -> dict:
    """Upload a walkthrough video: frames are pulled and checked, the speech is read, and the findings, report fields and a
    report draft are filled in. The prepared demo clip uses its transcript made offline (scripts/prepare_onsite_video_demo.py)."""
    import json as _json
    import shutil
    import uuid as _uuid
    from app.agents.tasks import image_check, rule_report
    from app.models.passport import Case, Customer, Event, Finding, OnsiteNote, Photo, Property, Reading, StoredReport
    from app import onsite_demo
    data = await video.read()
    hit = onsite_demo.match(video.filename or "", len(data))
    if not hit:
        raise HTTPException(422, "This demo is prepared for demo-videos/Stittsville_bathroom_walkthrough.mp4 (or the Montreal walkthrough clip).")
    key, cfg = hit
    folder = onsite_demo.DEMO_WEB / cfg["dir"]
    tr = onsite_demo.transcript(cfg)
    cid = f"{key}-video-" + _uuid.uuid4().hex[:4]
    (config.DATA_DIR / "uploads" / cid).mkdir(parents=True, exist_ok=True)
    case = Case(id=cid, title=cfg["title"], stage="inspected", language="en", project_no=301, contact_id=cfg["contact"],
                customer=Customer(type=cfg["type"], alias=cfg["alias"]), concern=cfg["concern"], intake_mode="upload",
                property=Property(province=cfg["province"], postal_prefix=cfg["fsa"], region_text=cfg["address"], in_service_area=True),
                seeded_from="sample inspections vol 2.1 (walkthrough video)")
    frames = []
    for i, t in enumerate(cfg["frames"]):
        src = folder / f"frame_{i + 1:02d}.jpg"
        rel = f"uploads/{cid}/f{i + 1:02d}.jpg"
        shutil.copyfile(src, config.DATA_DIR / rel)
        an = image_check(src.read_bytes())
        mo = next((m for m in cfg["moments"] if m[0] <= t <= m[1]), cfg["moments"][-1])
        said = " ".join(x["text"] for x in tr if t - 6 <= x["start"] <= t + 6)
        an.observations = [mo[3]] + an.observations[:2]
        case.photos.append(Photo(id=f"f{i + 1:02d}", path=rel, room=mo[2], source="inspector", caption_from_pack=f"{t // 60}:{t % 60:02d} · {mo[3][:60]}",
                                 analysis=an, analysis_model="frame check + transcript", analysis_tier="rule"))
        frames.append({"id": f"f{i + 1:02d}", "t": t, "url": f"/demo/{cfg['dir']}/frame_{i + 1:02d}.jpg", "room": mo[2], "finding": mo[3], "said": said,
                       "regions": [r.model_dump() for r in an.regions], "checks": an.observations[1:]})
    for k, (a, b, room, text, rd) in enumerate(cfg["moments"]):
        ev = [f["id"] for f in frames if a <= f["t"] <= b] or [frames[min(k, len(frames) - 1)]["id"]]
        case.findings.append(Finding(id=f"V{k + 1}", room=room, observation=text, evidence_photo_ids=ev, source="ai_structured", confirmed=True,
                                     readings=[Reading(kind=rd[0], result=rd[1], location=room, photo_ids=ev[:1])] if rd else []))
    case.recommendations = cfg["recs"]
    case.onsite.append(OnsiteNote(id="o" + _uuid.uuid4().hex[:6], kind="walkthrough", by="Inspector (video)", room=cfg["moments"][0][2],
                                  text=" ".join(x["text"] for x in tr), video_path=None, finding_ids=[f.id for f in case.findings]))
    case.report = StoredReport(draft=rule_report(case), tier="rule")
    case.stage = "report_draft"
    case.timeline.append(Event(at=clock.now(), at_text=clock.now().strftime("%b %d %H:%M"), step="Walkthrough video processed", system="MoldFlow",
                               what=f"{len(frames)} frames, {len(tr)} transcript lines, {len(case.findings)} findings, report drafted.", source="moldflow"))
    store.save(case)
    if (ct := db.get(Contact, cfg["contact"])) and cid not in ct.case_ids:
        ct.case_ids.append(cid)
        db.put(ct)
    fields = cfg["fields"]
    return {"case_id": cid, "duration_s": cfg["duration"], "frames": frames, "transcript": tr,
            "findings": [{"id": f.id, "room": f.room, "text": f.observation, "photos": f.evidence_photo_ids} for f in case.findings],
            "fields": fields, "recommendations": case.recommendations, "title": cfg["title"]}
