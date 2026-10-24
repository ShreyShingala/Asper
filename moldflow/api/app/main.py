import asyncio
import json
import logging
import shutil
import uuid
from datetime import date, datetime, timedelta

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel

from app import config, store
from app.agents import tasks
from app.agents.llm import AgentFailure, Result, prepare_image
from app.engine import checks, rules
from app.engine import live as live_rules
from app.exports import render
from app.integrations import elevenlabs
from app.models.agents import IntakeTurn
from app.models.passport import (Approval, Booking, Case, Event, Flag, FollowUp, Letter, LiveSession, Photo, PreAssessment, Reading,
                                 StoredReport, TranscriptLine, now)
from app.seed import seeds

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = FastAPI(title="MoldFlow API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup():
    if not store.list_all():
        seeds.seed_all(store.save)


def _get(case_id: str) -> Case:
    if not (c := store.get(case_id)):
        raise HTTPException(404, "case not found")
    return c


def _log(case: Case, res: Result):
    case.ai_usage.append(res.usage)


class CaseOut(BaseModel):
    case: Case
    turn: IntakeTurn | None = None


# ---------- cases ----------
@app.get("/health")
def health():
    return {"ok": True, "mode": config.DEMO_MODE, "model": config.PRIMARY_MODEL, "fallback": config.FALLBACK_MODEL,
            "key_configured": bool(config.OPENROUTER_API_KEY)}


@app.get("/cases")
def list_cases() -> list[Case]:
    return store.list_all()


class NewCase(BaseModel):
    language: str = "en"


@app.post("/cases")
def create_case(body: NewCase) -> CaseOut:
    cid = "c" + uuid.uuid4().hex[:8]
    case = Case(id=cid, title=f"Pre-assessment {cid}", language="fr" if body.language == "fr" else "en",
                timeline=[Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Pre-assessment started", system="MoldFlow web",
                                what="Customer opened the pre-assessment link (no app, no account).", source="moldflow")])
    store.save(case)
    return CaseOut(case=case, turn=rules.next_turn(case))


@app.get("/cases/{case_id}")
def get_case(case_id: str) -> CaseOut:
    c = _get(case_id)
    return CaseOut(case=c, turn=rules.next_turn(c) if c.stage == "intake" else None)


class LangIn(BaseModel):
    language: str


@app.post("/cases/{case_id}/language")
async def set_language(case_id: str, body: LangIn) -> CaseOut:
    async with store.editing(case_id) as c:
        c.language = "fr" if body.language == "fr" else "en"
    return CaseOut(case=c, turn=rules.next_turn(c))


class AnswerIn(BaseModel):
    key: str
    value: str


def _apply_answer(c: Case, key: str, v: str) -> None:
    c.answers[key] = v
    if key == "occupant":
        c.customer.type = {"Owner": "homeowner", "Tenant": "tenant", "Landlord / manager": "landlord"}.get(v, "unknown")
    elif key == "symptoms":
        c.health_flag = v == "Yes"
    elif key == "location":
        rules.apply_location(c, v)
    elif key == "concern":
        c.concern = v
    elif key == "room":
        for p in c.photos:
            p.room = p.room or v


@app.post("/cases/{case_id}/answers")
async def answer(case_id: str, body: AnswerIn) -> CaseOut:
    async with store.editing(case_id) as c:
        _apply_answer(c, body.key, rules.canon(body.value.strip()))
    return CaseOut(case=c, turn=rules.next_turn(c))


async def _analyze(case_id: str, photo_id: str, image: bytes, prompt_text: str | None, fixture_key: str | None):
    c = _get(case_id)
    photo = c.photo(photo_id)
    try:
        res = await tasks.analyze_photo(c, photo, image, prompt_text, fixture_key)
    except AgentFailure as e:
        logging.warning("photo analysis failed: %s", e)
        return
    async with store.editing(case_id) as c:
        p = c.photo(photo_id)
        p.analysis, p.analysis_tier, p.analysis_latency_ms, p.analysis_model = res.value, res.usage.tier, res.usage.latency_ms, res.usage.model
        _log(c, res)


def _prompt_text(case: Case, prompt_id: str | None) -> str | None:
    return next((p.text for p in rules.PHOTO_PROMPTS[case.language] if p.prompt_id == prompt_id), None)


@app.post("/cases/{case_id}/photos")
async def upload_photo(case_id: str, file: UploadFile = File(...), source: str = Form("customer"), prompt_id: str | None = Form(None),
                       room: str | None = Form(None), fixture_key: str | None = Form(None)) -> CaseOut:
    c = _get(case_id)
    if c.intake_mode == "live" and source != "inspector" and len(live_rules.customer_photos(c)) >= config.LIVE_MAX_PHOTOS:
        raise HTTPException(409, f"This live call already has {config.LIVE_MAX_PHOTOS} photos, the maximum.")
    try:
        img = prepare_image(await file.read())
    except Exception:
        raise HTTPException(400, "Could not read that image. Try a JPEG or PNG.")
    pid = "u" + uuid.uuid4().hex[:6]
    rel = f"uploads/{case_id}/{pid}.jpg"
    (config.DATA_DIR / "uploads" / case_id).mkdir(parents=True, exist_ok=True)
    (config.DATA_DIR / rel).write_bytes(img)
    async with store.editing(case_id) as c:
        c.photos.append(Photo(id=pid, path=rel, room=room or c.answers.get("room"), source="inspector" if source == "inspector" else "customer",
                              prompt_id=prompt_id))
    await _analyze(case_id, pid, img, _prompt_text(c, prompt_id), fixture_key)
    c = _get(case_id)
    return CaseOut(case=c, turn=rules.next_turn(c) if c.stage == "intake" else None)


@app.post("/cases/{case_id}/sample-photos")
async def sample_photos(case_id: str) -> CaseOut:
    """Escape hatch for demos: inject Job 2's three real customer photos (fixture-backed)."""
    mapping = [("01_Discoloration_dryer_vent_hose.jpg", "wide"), ("03_Discoloration_vent_grille.jpg", "close"),
               ("02_Discoloration_ceiling_vent.jpg", "above")]
    async with store.editing(case_id) as c:
        existing = {p.prompt_id for p in c.photos}
        new = []
        for fname, prompt in mapping:
            if prompt in existing:
                continue
            pid = f"s{fname[:2]}"
            c.photos.append(Photo(id=pid, path=f"02_Virtual_Sample/Photos/{fname}", room=c.answers.get("room") or "Laundry",
                                  source="customer", prompt_id=prompt, caption_from_pack=seeds.caption(fname)))
            new.append((pid, fname, prompt))
    await asyncio.gather(*[_analyze(case_id, pid, prepare_image((config.PACK_DIR / "02_Virtual_Sample/Photos" / fname).read_bytes()),
                                    _prompt_text(c, prompt), f"photo:sample:{fname}:{c.language}") for pid, fname, prompt in new])
    c = _get(case_id)
    return CaseOut(case=c, turn=rules.next_turn(c))


class SkipIn(BaseModel):
    prompt_id: str


@app.post("/cases/{case_id}/skip-photo")
async def skip_photo(case_id: str, body: SkipIn) -> CaseOut:
    async with store.editing(case_id) as c:
        c.answers[f"skip:{body.prompt_id}"] = "yes"
    return CaseOut(case=c, turn=rules.next_turn(c))


@app.post("/cases/{case_id}/pre-assessment")
async def pre_assessment(case_id: str) -> CaseOut:
    c = _get(case_id)
    if not any(p.analysis for p in c.photos):
        raise HTTPException(400, "Add at least one photo first.")
    sample = any(p.id.startswith("s") for p in c.photos)
    try:
        res = await tasks.assess(c, f"assess:sample:{c.language}:{c.answers.get('symptoms')}:{c.property.in_service_area}" if sample else None)
    except AgentFailure as e:
        raise HTTPException(503, f"AI unavailable, case flagged for a human: {e}")
    draft = res.value
    async with store.editing(case_id) as c:
        _log(c, res)
        routing = rules.route(c, draft)
        c.recommended_service, c.routing_reasons, c.unknowns = routing.service, routing.reasons, routing.unknowns
        c.pre_assessment = PreAssessment(
            summary=draft.summary, observed=draft.observed, cannot_tell=draft.cannot_tell, recommended_service=routing.service,
            service_price_text=rules.price_text(c, routing.service), reasons=routing.reasons,
            annotated_photo_ids=[p.id for p in c.photos if p.analysis and p.analysis.regions],
            next_actions=rules.next_actions(c, routing.service), health_note=rules.HEALTH_TEXT[c.language] if c.health_flag else None,
            tier=res.usage.tier)
        c.stage = "pre_assessed"
        c.title = f"{c.customer.type.title()} · {c.answers.get('room', 'Unknown room')} · {c.property.postal_prefix or c.property.country}"
        if routing.escalate:
            c.flags.append(Flag(id="esc_" + c.id, check="guardrail", severity="warn", message="AI asked for human review of this pre-assessment."))
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Pre-assessment ready", system="MoldFlow",
                                what=f"Recommended: {routing.service}. Photos: {len(c.photos)}.", source="moldflow"))
    return CaseOut(case=c)


# ---------- live camera + voice pre-assessment ----------
@app.get("/live/config")
def live_config() -> dict:
    return {"enabled": elevenlabs.enabled(), "max_photos": config.LIVE_MAX_PHOTOS, "max_seconds": config.LIVE_MAX_SECONDS}


@app.post("/cases/{case_id}/live/start")
async def live_start(case_id: str) -> dict:
    _get(case_id)
    try:
        url = await elevenlabs.signed_url()
    except elevenlabs.VoiceUnavailable as e:
        raise HTTPException(503, str(e))
    async with store.editing(case_id) as c:
        c.intake_mode, c.language = "live", "en"
        c.live = c.live or LiveSession()
        if not any(e.step == "Live call started" for e in c.timeline):
            c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Live call started", system="MoldFlow + ElevenLabs",
                                    what="Customer started a live camera + voice pre-assessment.", source="moldflow"))
    return {"signed_url": url, "max_photos": config.LIVE_MAX_PHOTOS, "max_seconds": config.LIVE_MAX_SECONDS, "checklist": live_rules.checklist(c)}


@app.get("/cases/{case_id}/live/checklist")
def live_checklist(case_id: str) -> dict:
    return live_rules.checklist(_get(case_id))


@app.post("/cases/{case_id}/live/answer")
async def live_answer(case_id: str, body: AnswerIn) -> dict:
    """Agent tool target. Returns 200 with ok=false on a bad value so the agent can re-ask instead of failing the call."""
    try:
        v = live_rules.validate_answer(body.key, body.value)
    except ValueError as e:
        return {"ok": False, "error": str(e), "checklist": live_rules.checklist(_get(case_id))}
    async with store.editing(case_id) as c:
        _apply_answer(c, body.key, v)
    return {"ok": True, "saved": {body.key: v}, "checklist": live_rules.checklist(c)}


class LiveEndIn(BaseModel):
    conversation_id: str | None = None
    transcript: list[TranscriptLine] = []


@app.post("/cases/{case_id}/live/end")
async def live_end(case_id: str, body: LiveEndIn) -> CaseOut:
    async with store.editing(case_id) as c:
        c.live = c.live or LiveSession()
        c.live.conversation_id = body.conversation_id or c.live.conversation_id
        c.live.transcript = [t for t in body.transcript if t.text.strip()][:400]
        c.live.ended_at = now()
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Live call ended", system="MoldFlow + ElevenLabs",
                                what=f"{len(c.live.transcript)} transcript lines, {len(live_rules.customer_photos(c))} photos.", source="moldflow"))
    if any(t.role == "customer" for t in c.live.transcript):
        try:
            res = await tasks.live_summary(c)
        except AgentFailure as e:
            logging.warning("live summary failed: %s", e)
        else:
            async with store.editing(case_id) as c:
                _log(c, res)
                c.live.summary, c.live.key_points, c.live.summary_tier = res.value.summary, res.value.key_points[:6], res.usage.tier
                if not c.concern and res.value.concern.strip():
                    _apply_answer(c, "concern", res.value.concern.strip())
    return CaseOut(case=c, turn=rules.next_turn(c) if c.stage == "intake" else None)


@app.get("/cases/{case_id}/export/pre-assessment.pdf")
def export_pre(case_id: str):
    return Response(render.pre_assessment_pdf(_get(case_id)), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="pre-assessment-{case_id}.pdf"'})


@app.post("/cases/{case_id}/letters/landlord")
async def landlord_letter(case_id: str, body: LangIn) -> Letter:
    async with store.editing(case_id) as c:
        lang = "fr" if body.language == "fr" else "en"
        text, ids = rules.landlord_letter(c, lang)
        letter = Letter(body=text, language=lang, based_on_ids=ids)
        c.letters.append(letter)
    return letter


class BookIn(BaseModel):
    service: str
    slot_text: str = "Next available slot"


@app.post("/cases/{case_id}/book")
async def book(case_id: str, body: BookIn) -> CaseOut:
    async with store.editing(case_id) as c:
        paid = body.service == "remote_report"
        c.booking = Booking(service=body.service, slot_text=body.slot_text, status="paid_simulated" if paid else "requested_simulated")
        c.stage = "inspection_booked" if not paid else "report_approved"
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Booked" if not paid else "Remote report purchased",
                                system="MoldFlow (simulated)", what=f"{body.service}: {body.slot_text}", source="simulated"))
    return CaseOut(case=c)


# ---------- inspector ----------
class NoteIn(BaseModel):
    room: str
    text: str


@app.post("/cases/{case_id}/findings/from-note")
async def from_note(case_id: str, body: NoteIn) -> CaseOut:
    c = _get(case_id)
    try:
        new, res = await tasks.findings_from_note(c, body.room, body.text)
    except AgentFailure as e:
        raise HTTPException(503, f"AI unavailable: {e}")
    async with store.editing(case_id) as c:
        _log(c, res)
        c.findings.extend(new)
        c.flags = checks.run_all(c)
    return CaseOut(case=c)


class FindingPatch(BaseModel):
    confirmed: bool | None = None
    observation: str | None = None


@app.patch("/cases/{case_id}/findings/{fid}")
async def patch_finding(case_id: str, fid: str, body: FindingPatch) -> CaseOut:
    async with store.editing(case_id) as c:
        f = next((x for x in c.findings if x.id == fid), None)
        if not f:
            raise HTTPException(404, "finding not found")
        if body.observation is not None:
            f.observation = body.observation
        if body.confirmed is not None:
            f.confirmed = body.confirmed
        c.flags = checks.run_all(c)
    return CaseOut(case=c)


@app.delete("/cases/{case_id}/findings/{fid}")
async def delete_finding(case_id: str, fid: str) -> CaseOut:
    async with store.editing(case_id) as c:
        c.findings = [x for x in c.findings if x.id != fid]
        c.flags = checks.run_all(c)
    return CaseOut(case=c)


class ReadingIn(BaseModel):
    room: str
    kind: str
    result: str
    photo_id: str | None = None


@app.post("/cases/{case_id}/readings")
async def add_reading(case_id: str, body: ReadingIn) -> CaseOut:
    async with store.editing(case_id) as c:
        photo_ids = [body.photo_id] if body.photo_id else [p.id for p in c.photos if p.room == body.room][:1]
        if not photo_ids:
            raise HTTPException(400, "Add a photo for this room first; every finding must cite evidence.")
        try:
            r = Reading(kind=body.kind, result=body.result, location=body.room, photo_ids=photo_ids)
        except Exception as e:
            raise HTTPException(422, str(e))
        fid = f"R-{body.room}-{body.kind}".replace(" ", "_")
        c.findings = [f for f in c.findings if f.id != fid]
        if body.result != "not_recorded":
            from app.models.passport import Finding
            c.findings.append(Finding(id=fid, room=body.room, observation=f"{body.kind.replace('_', ' ')} reading: {body.result.replace('_', ' ')}",
                                      readings=[r], evidence_photo_ids=photo_ids, source="inspector_entered", confirmed=True))
        c.flags = checks.run_all(c)
    return CaseOut(case=c)


# ---------- review ----------
@app.post("/cases/{case_id}/report/draft")
async def report_draft(case_id: str) -> CaseOut:
    c = _get(case_id)
    try:
        draft, dropped, res = await tasks.draft_report(c)
    except AgentFailure as e:
        raise HTTPException(503, f"AI unavailable: {e}")
    async with store.editing(case_id) as c:
        _log(c, res)
        c.report = StoredReport(draft=draft, dropped_claims=dropped, tier=res.usage.tier)
        c.stage = "report_draft"
        c.flags = checks.run_all(c)
        c.flags = [f for f in c.flags if f.id != "uncited"]
        if dropped:
            c.flags.append(Flag(id="uncited", check="completeness", severity="info",
                                message=f"{len(dropped)} AI sentence(s) had no evidence citation and were removed from the draft: "
                                        + " | ".join(d[:80] for d in dropped[:3])))
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Report drafted", system="MoldFlow",
                                what=f"Draft generated in {res.usage.latency_ms/1000:.1f}s ({res.usage.tier}).", source="moldflow"))
    return CaseOut(case=c)


@app.post("/cases/{case_id}/checks")
async def rerun_checks(case_id: str) -> CaseOut:
    async with store.editing(case_id) as c:
        c.flags = checks.run_all(c)
    return CaseOut(case=c)


class ResolveIn(BaseModel):
    note: str
    by: str


@app.post("/cases/{case_id}/flags/{fid}/resolve")
async def resolve_flag(case_id: str, fid: str, body: ResolveIn) -> CaseOut:
    async with store.editing(case_id) as c:
        f = next((x for x in c.flags if x.id == fid), None)
        if not f:
            raise HTTPException(404, "flag not found")
        f.resolved, f.resolution_note, f.resolved_by = True, body.note, body.by
    return CaseOut(case=c)


class ApproveIn(BaseModel):
    what: str
    reviewed_by: str


@app.post("/cases/{case_id}/approve")
async def approve(case_id: str, body: ApproveIn) -> CaseOut:
    async with store.editing(case_id) as c:
        if body.what == "report" and not c.report:
            raise HTTPException(400, "Draft the report first.")
        if blocks := c.open_blocks():
            raise HTTPException(409, "Resolve blocking flags first: " + " | ".join(b.message[:90] for b in blocks))
        c.approvals.append(Approval(what=body.what, reviewed_by=body.reviewed_by))
        if body.what == "report":
            c.stage = "report_approved"
        elif body.what == "estimate" and c.estimate:
            c.estimate.status, c.stage = "approved", "quoted"
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step=f"{body.what.title()} approved", system="MoldFlow",
                                what=f"Drafted by MoldFlow · Reviewed by {body.reviewed_by}", source="moldflow"))
    return CaseOut(case=c)


@app.get("/cases/{case_id}/export/report.pdf")
def export_report(case_id: str):
    return Response(render.report_pdf(_get(case_id)), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="report-{case_id}.pdf"'})


@app.get("/cases/{case_id}/export/estimate.csv")
def export_csv(case_id: str):
    c = _get(case_id)
    if not c.estimate:
        raise HTTPException(404, "no estimate")
    return PlainTextResponse(render.estimate_csv(c), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{c.estimate.id}.csv"'})


# ---------- follow-up ----------
class FollowIn(BaseModel):
    as_of: date | None = None


def _prior_messages(c: Case) -> list[str]:
    return [e.what for e in c.timeline if e.source == "sample_pack" and ("SMS" in e.what or "email" in e.what.lower())]


@app.post("/cases/{case_id}/followups/draft")
async def followup_draft(case_id: str, body: FollowIn) -> CaseOut:
    c = _get(case_id)
    if not c.estimate:
        raise HTTPException(400, "No estimate on this case.")
    as_of = body.as_of or date.today()
    try:
        d, offer_issues, res = await tasks.draft_followup(c, as_of, _prior_messages(c))
    except AgentFailure as e:
        raise HTTPException(503, f"AI unavailable: {e}")
    async with store.editing(case_id) as c:
        _log(c, res)
        fu = FollowUp(id="fu" + uuid.uuid4().hex[:6], channel=d.channel, body=d.body, reason=d.reason, cites=d.cites,
                      offer_token_used=d.uses_offer_token, as_of=as_of, tier=res.usage.tier)
        c.followups.append(fu)
        for msg in offer_issues:
            c.flags.append(Flag(id=f"offer_{fu.id}", check="offer", severity="block", refs=[fu.id], message=msg))
    return CaseOut(case=c)


class BatchIn(BaseModel):
    items: list[tuple[str, str]]
    by: str


@app.post("/followups/approve-batch")
async def approve_batch(body: BatchIn) -> dict:
    done = 0
    for case_id, fu_id in body.items:
        async with store.editing(case_id) as c:
            if any(f.check == "offer" and not f.resolved and fu_id in f.refs for f in c.flags):
                continue
            for fu in c.followups:
                if fu.id == fu_id and fu.status == "draft":
                    fu.status = "sent_simulated"
                    c.approvals.append(Approval(what="followup", reviewed_by=body.by))
                    c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Follow-up sent (simulated)",
                                            system="MoldFlow", what=fu.body, source="simulated"))
                    done += 1
    return {"approved": done}


# ---------- dashboard / compare / proof ----------
@app.get("/dashboard")
def dashboard() -> dict:
    cases = store.list_all()
    inbox = []
    for c in cases:
        for f in c.flags:
            if not f.resolved and f.severity in ("block", "warn") and f.check != "completeness":
                inbox.append({"case_id": c.id, "title": c.title, "kind": "flag", "severity": f.severity, "text": f.message, "id": f.id})
        for fu in c.followups:
            if fu.status == "draft":
                inbox.append({"case_id": c.id, "title": c.title, "kind": "followup", "severity": "info", "text": fu.body, "id": fu.id, "reason": fu.reason})
        if c.stage == "report_draft":
            inbox.append({"case_id": c.id, "title": c.title, "kind": "approval", "severity": "info", "text": "Report draft awaiting review", "id": "report"})
        if c.stage == "pre_assessed":
            inbox.append({"case_id": c.id, "title": c.title, "kind": "new_lead", "severity": "info",
                          "text": f"New pre-assessment: {c.recommended_service}", "id": "pa"})
    pipeline = sum((c.estimate.total for c in cases if c.estimate and c.estimate.status in ("sent", "viewed", "approved", "draft")), start=0)
    stalled = sum((c.estimate.total for c in cases if c.estimate and "not accepted" in (c.estimate.real_world_status or "")), start=0)
    return {"cases": [{"id": c.id, "title": c.title, "stage": c.stage, "service": c.recommended_service, "flags": len([f for f in c.flags if not f.resolved and f.severity != "info"]),
                       "total": str(c.estimate.total) if c.estimate else None, "estimate_status": c.estimate.status if c.estimate else None,
                       "created_at": c.created_at.isoformat()} for c in cases],
            "inbox": inbox, "pipeline_total": str(pipeline), "recorded_viewed_not_accepted_total": str(stalled)}


@app.get("/compare/job1")
def compare_job1() -> dict:
    c = _get("job1")
    real = [e for e in c.timeline if e.source == "sample_pack"]
    generic = [e for e in real if e.step.startswith("Follow-up") or e.step in ("Sales follow-up starts", "Manual follow-up")]
    mf = [e for e in c.timeline if e.source != "sample_pack"]
    report_ai = [u for u in c.ai_usage if u.agent == "report"]
    flags_caught = [f.message for f in c.flags if f.check in ("scope", "record_conflict", "estimate") and f.severity != "info"]
    return {
        "before": [e.model_dump(mode="json") for e in real],
        "moldflow_events": [e.model_dump(mode="json") for e in mf],
        "followups": [f.model_dump(mode="json") for f in c.followups],
        "counters": {
            "report_elapsed_before": "45h 35m (inspection Oct 6 11:30 -> report email Oct 8 09:05; elapsed, not labour)",
            "report_window_before": "82 min write/review window, 2 staff (Oct 7 12:42-14:04)",
            "report_ai_draft_seconds": round(report_ai[-1].latency_ms / 1000, 1) if report_ai else None,
            "report_approved": any(a.what == "report" for a in c.approvals),
            "generic_touches_before": len(generic),
            "concern_answered_before": 0,
            "concern_specific_followups_after": len(c.followups),
            "issues_caught_before_sending": flags_caught,
            "expiry": c.estimate.expires_on.isoformat() if c.estimate and c.estimate.expires_on else None,
        },
    }


@app.get("/proof")
def proof() -> dict:
    path = config.API_DIR / "proof" / "eval_photos.json"
    evald = json.loads(path.read_text()) if path.exists() else None
    usage = [u for c in store.list_all() for u in c.ai_usage]
    live = [u for u in usage if u.tier in ("live", "fallback")]
    by_agent = {}
    for u in live:
        a = by_agent.setdefault(u.agent, {"calls": 0, "ms": 0, "tokens_in": 0, "tokens_out": 0, "cost": 0.0})
        a["calls"] += 1
        a["ms"] += u.latency_ms
        a["tokens_in"] += u.tokens_in or 0
        a["tokens_out"] += u.tokens_out or 0
        a["cost"] += u.cost_usd or 0
    for a in by_agent.values():
        a["avg_s"] = round(a["ms"] / a["calls"] / 1000, 1)
    return {"eval": evald, "usage_by_agent": by_agent, "calls_total": len(usage), "live_calls": len(live),
            "model": config.PRIMARY_MODEL}


@app.get("/photos/{case_id}/{photo_id}")
def photo(case_id: str, photo_id: str):
    p = _get(case_id).photo(photo_id)
    if not p:
        raise HTTPException(404)
    return FileResponse(render.photo_file(p))


@app.post("/admin/reset")
def reset() -> dict:
    ids = [c.id for c in store.list_all()]
    store.wipe()
    for cid in ids:  # only delete MoldFlow's own per-case upload folders, never the whole directory
        d = config.UPLOAD_DIR / cid
        if d.is_dir() and d.parent == config.UPLOAD_DIR:
            shutil.rmtree(d, ignore_errors=True)
    cases = seeds.seed_all(store.save)
    return {"ok": True, "cases": [c.id for c in cases]}
