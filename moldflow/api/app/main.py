import asyncio
import json
import logging
import re
import shutil
from contextlib import asynccontextmanager
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel

from app import clock, config, store
from app.agents import bruce, tasks
from app.agents.llm import AgentFailure, Result, prepare_image, structured
from app.engine import autopilot, booking, checks, photo_plan, rules, tenant_pack
from app.engine import live as live_rules
from app.exports import render
from app.integrations import elevenlabs
from app.models.agents import IntakeTurn
from app.models.passport import (Approval, Booking, BookingContact, Case, Event, Finding, Flag, FollowUp, Letter, LiveSession, OnsiteNote, OutboxMessage, Payment, Photo, PreAssessment, Reading,
                                 StoredReport, TranscriptLine, now)
from app.seed import seeds

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
@asynccontextmanager
async def lifespan(_app):
    _startup()
    yield


app = FastAPI(title="MoldFlow API", version="1.0", lifespan=lifespan)
from app.routers import hub as hub_router  # noqa: E402

from app.demo_api import router as demo_router  # noqa: E402
app.include_router(demo_router)  # before the hub router: /people/overview must win over /people/{cid}
app.include_router(hub_router.router)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
from app.projects_api import router as projects_router  # noqa: E402
app.include_router(projects_router)


def _seed_everything() -> list[Case]:
    from app import crm_store
    from app.routers.hub import run_moments  # noqa: F401  (moments are recomputed below)
    from app.seed import crm_seed
    cases = seeds.seed_all(store.save)
    crm_store.wipe_all()
    for c in cases:  # link the real sample-pack cases to their contact
        c.contact_id = f"c-{c.id}"
        store.save(c)
    crm_seed.seed(cases)
    from app.seed import demo6
    demo6.seed(cases)
    from app import messaging
    from app.models.crm import Contact
    for contact in crm_store.query(Contact):
        messaging.recompute_moments(contact)
    return cases


def _startup():
    from app import crm_store
    from app.models.crm import Contact
    if not store.list_all() or not crm_store.query(Contact):
        store.wipe()
        _seed_everything()


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


_BACKGROUND: set[asyncio.Task] = set()


def _prompt_text(case: Case, prompt_id: str | None) -> str | None:
    if plan := photo_plan.plan_for_case(case.answers):
        if shot := next((s for s in plan if s.id == prompt_id), None):
            return f"{shot.title} ({shot.room}, {photo_plan.SURFACES[shot.surface].lower()}): {shot.instruction}"
    return next((p.text for p in rules.PHOTO_PROMPTS[case.language] if p.prompt_id == prompt_id), None)


def _shot_room(case: Case, prompt_id: str | None) -> str | None:
    plan = photo_plan.plan_for_case(case.answers) or []
    return next((s.room for s in plan if s.id == prompt_id), None)


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
        c.photos.append(Photo(id=pid, path=rel, room=room or _shot_room(c, prompt_id) or c.answers.get("room"), source="inspector" if source == "inspector" else "customer",
                              prompt_id=prompt_id))
    task = asyncio.create_task(_analyze(case_id, pid, img, _prompt_text(c, prompt_id), fixture_key))
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)
    try:  # never hold the request open long (phone tunnels drop requests after ~100 s); analysis finishes in the background
        await asyncio.wait_for(asyncio.shield(task), timeout=config.PHOTO_WAIT_S)
    except asyncio.TimeoutError:
        logging.info("photo %s: analysis still running, returning early", pid)
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
        c.title = f"{c.customer.type.replace('_', ' ').title()} · {c.answers.get('room', 'Unknown room')} · {c.property.postal_prefix or c.property.country}"
        if routing.escalate:
            c.flags.append(Flag(id="esc_" + c.id, check="guardrail", severity="warn", message="AI asked for human review of this pre-assessment."))
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Pre-assessment ready", system="MoldFlow",
                                what=f"Recommended: {routing.service}. Photos: {len(c.photos)}.", source="moldflow"))
    await _run_autopilot(case_id)
    return CaseOut(case=_get(case_id))


# ---------- live camera + voice pre-assessment ----------
def _default_voice() -> str:
    if config.LIVE_VOICE in ("elevenlabs", "mock"):
        return config.LIVE_VOICE
    return "elevenlabs" if elevenlabs.enabled() else "mock"


def _mock_available() -> bool:
    return bool(config.OPENROUTER_API_KEY) or config.DEMO_MODE == "fixture"


@app.get("/live/config")
def live_config() -> dict:
    voice = _default_voice()
    return {"enabled": elevenlabs.enabled() if voice == "elevenlabs" else _mock_available(), "voice": voice,
            "mock_available": _mock_available(), "max_photos": config.LIVE_MAX_PHOTOS, "max_seconds": config.LIVE_MAX_SECONDS}


class LiveStartIn(BaseModel):
    voice: str | None = None  # "elevenlabs" | "mock"; defaults to the server setting


@app.post("/cases/{case_id}/live/start")
async def live_start(case_id: str, body: LiveStartIn | None = None) -> dict:
    _get(case_id)
    voice = (body.voice if body and body.voice in ("elevenlabs", "mock") else None) or _default_voice()
    url = None
    if voice == "elevenlabs":
        try:
            url = await elevenlabs.signed_url()
        except elevenlabs.VoiceUnavailable as e:
            raise HTTPException(503, str(e))
    elif not _mock_available():
        raise HTTPException(503, "The test voice needs OPENROUTER_API_KEY on the server.")
    system = "MoldFlow + ElevenLabs" if voice == "elevenlabs" else "MoldFlow (test voice)"
    async with store.editing(case_id) as c:
        c.intake_mode, c.language = "live", "en"
        c.live = c.live or LiveSession()
        if not any(e.step == "Live call started" for e in c.timeline):
            c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Live call started", system=system,
                                    what="Customer started a live camera + voice pre-assessment.", source="moldflow"))
    return {"voice": voice, "signed_url": url, "first_message": bruce.FIRST_MESSAGE, "max_photos": config.LIVE_MAX_PHOTOS,
            "max_seconds": config.LIVE_MAX_SECONDS, "checklist": live_rules.checklist(c)}


class MockTurnIn(BaseModel):
    history: list[dict] = []


@app.post("/cases/{case_id}/live/mock/turn")
async def live_mock_turn(case_id: str, body: MockTurnIn) -> bruce.BruceTurn:
    """Free test voice: Bruce's real prompt and tool contracts run on the OpenRouter model. The browser speaks the reply with
    its built-in speech synthesis, runs the tools itself (same handlers as the ElevenLabs call) and sends the results back."""
    c = _get(case_id)
    history = body.history[-70:]
    from app.agents.llm import quota_exhausted
    turn: bruce.BruceTurn | None = None
    if not quota_exhausted():
        try:
            res = await asyncio.wait_for(structured(bruce.BruceTurn, agent="bruce_mock", system=bruce.PROMPT + bruce.TURN_NOTE,
                                                    user_text=json.dumps({"conversation_so_far": history}), max_tokens=500, temperature=0.3),
                                         timeout=12)
            turn = res.value
        except (AgentFailure, asyncio.TimeoutError) as e:
            logging.info("Bruce AI unavailable (%s); using the rule-based coach", type(e).__name__)
    if turn is None:  # quota used up, slow or failing: Bruce keeps working on rules instead of "sorry, I missed that"
        turn = bruce.rule_turn(history, live_rules.checklist(c))
    turn.say = re.sub(r"\[[a-z ]{2,24}\]\s*", "", turn.say).strip()
    turn.tools = turn.tools[:4]
    return turn


@app.get("/live/precall")
def live_precall_options() -> dict:
    return photo_plan.precall_options()


class SpotIn(BaseModel):
    room: str
    surface: str


class PrecallIn(BaseModel):
    spots: list[SpotIn]
    size: str
    smell_leak: str
    location: str


@app.post("/cases/{case_id}/live/precall")
async def live_precall(case_id: str, body: PrecallIn) -> dict:
    """The 5 tap questions before the call. Saves them as normal intake answers (so routing/pricing work unchanged) and
    returns the personalized photo plan."""
    spots = [s.model_dump() for s in body.spots if s.room in photo_plan.ROOMS and s.surface in photo_plan.SURFACES][:photo_plan.MAX_SPOTS]
    if not spots:
        raise HTTPException(422, "Pick at least one spot (room and where in it).")
    if body.size not in photo_plan.SIZES or body.smell_leak not in photo_plan.SMELL_LEAK:
        raise HTTPException(422, "Answer the size and smell/leak questions.")
    try:
        location = live_rules.validate_answer("location", body.location)
    except ValueError as e:
        raise HTTPException(422, str(e))
    odor, leak = photo_plan.SMELL_LEAK_ANSWERS[body.smell_leak]
    async with store.editing(case_id) as c:
        c.intake_mode, c.language = "live", "en"
        c.answers["spots"] = json.dumps(spots)
        c.answers["size"] = body.size
        for key, value in (("room", spots[0]["room"]), ("odor", odor), ("leak", leak), ("location", location)):
            _apply_answer(c, key, value)
    plan = photo_plan.plan_for_case(c.answers) or []
    return {"plan": photo_plan.plan_dicts(plan), "checklist": live_rules.checklist(c)}


@app.post("/cases/{case_id}/live/locate")
async def live_locate(case_id: str, file: UploadFile = File(...), target: str = Form(...)) -> dict:
    """Focus box helper: where in this live frame is the target (e.g. 'the discoloured patch')? Not saved to the case."""
    _get(case_id)
    if config.E2E_STUB:
        return {"found": False}
    try:
        img = prepare_image(await file.read(), max_side=640)
        res = await tasks.locate(img, target)
    except AgentFailure as e:
        raise HTTPException(503, f"Locator unavailable: {e}")
    except Exception:
        raise HTTPException(400, "Could not read that frame.")
    out = res.value
    return {"found": bool(out.found and out.box), "box_2d": out.box.box_2d if out.found and out.box else None, "label": out.label}


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


# ---------- checkout (simulated) + tenant action pack ----------
class CheckoutIn(BaseModel):
    product: str
    card_name: str = ""
    card_number: str = "4242 4242 4242 4242"
    tenant_name: str | None = None
    tenant_email: str | None = None
    tenant_phone: str | None = None
    landlord_name: str | None = None
    landlord_email: str | None = None
    authorize_auto: bool = True   # tenant authorizes each ladder step to be sent on their behalf without asking again


def _kill_switch_on() -> bool:
    from app import crm_store
    return crm_store.autonomy().paused


def _auto_ladder(c: Case) -> None:
    """Send any drafted ladder step the tenant pre-authorized, unless the owner hit the kill switch."""
    pack = c.tenant_pack
    if not pack or not pack.auto_send:
        return
    for m in c.outbox:
        if m.step is not None and m.status == "awaiting_approval":
            if _kill_switch_on():
                m.reason = "Held: all outbound paused (kill switch)."
                continue
            m.approved_by.append("tenant (authorized at checkout)")
            _send(c, m)


async def _run_autopilot(case_id: str) -> None:
    async with store.editing(case_id) as c:
        if autopilot.ensure_contact(c):
            autopilot.sync(c)


@app.post("/cases/{case_id}/checkout")
async def checkout(case_id: str, body: CheckoutIn) -> CaseOut:
    """Fake checkout: records a simulated payment. No card data is stored beyond the last 4 digits."""
    if body.product not in tenant_pack.PRICES:
        raise HTTPException(422, "Unknown product.")
    digits = "".join(ch for ch in body.card_number if ch.isdigit())
    if len(digits) < 12:
        raise HTTPException(422, "Enter a card number (test mode: 4242 4242 4242 4242).")
    if body.product == "tenant_pack" and not all((body.tenant_name, body.tenant_email, body.landlord_name, body.landlord_email)):
        raise HTTPException(422, "Your name and email and your landlord's name and email are needed to write on your behalf.")
    async with store.editing(case_id) as c:
        if any(p.product == body.product for p in c.payments):
            raise HTTPException(409, "Already purchased.")
        c.payments.append(Payment(id="pay_" + uuid.uuid4().hex[:8], product=body.product,
                                  amount=Decimal(tenant_pack.PRICES[body.product]), card_last4=digits[-4:]))
        what = "AI pre-assessment report" if body.product == "ai_report" else "Tenant action pack"
        if body.product == "ai_report":
            c.booking = c.booking or Booking(service="remote_report", slot_text="Remote report", status="paid_simulated")
        else:
            tenant_pack.start(c, body.tenant_name.strip(), body.tenant_email.strip(), body.landlord_name.strip(), body.landlord_email.strip())
            c.tenant_pack.auto_send = body.authorize_auto
            c.customer.alias = body.tenant_name.strip()
            c.customer.type = "tenant"
            _auto_ladder(c)
            autopilot.ensure_contact(c, body.tenant_name.strip(), (body.tenant_phone or "").strip(), body.tenant_email.strip())
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step=f"Paid: {what}", system="MoldFlow checkout (simulated)",
                                what=f"${tenant_pack.PRICES[body.product]} · card ending {digits[-4:]}", source="simulated"))
    return CaseOut(case=c)


class ContactIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""


@app.post("/cases/{case_id}/contact")
async def case_contact(case_id: str, body: ContactIn) -> dict:
    """Basic fields entered in the app -> the person's Hub profile, then Autopilot drafts/sends the next message."""
    if not (body.phone.strip() or body.email.strip()):
        raise HTTPException(422, "Add a phone number or an email so we can reach you.")
    async with store.editing(case_id) as c:
        contact = autopilot.ensure_contact(c, body.name.strip(), body.phone.strip(), body.email.strip())
        c.customer.alias = body.name.strip() or c.customer.alias
        sent = autopilot.sync(c)
    return {"contact_id": contact.id if contact else None, "messages": [{"trigger": m.trigger, "status": m.status, "body": m.final_body or m.body}
                                                                        for m in sent]}


@app.get("/cases/{case_id}/pack")
def pack_view(case_id: str) -> dict:
    c = _get(case_id)
    return {"pack": c.tenant_pack, "ladder": tenant_pack.ladder_view(c), "today": tenant_pack.today().isoformat(),
            "outbox": [m for m in c.outbox if m.step is not None], "paused": _kill_switch_on()}


class DecisionIn(BaseModel):
    by: str = "tenant"          # "tenant" or a staff name
    body: str | None = None     # edited text, if any
    reason: str | None = None   # for deny


def _send(c: Case, m: OutboxMessage) -> None:
    m.status, m.sent_at = "sent_simulated", now()
    c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step=f"Sent: {m.subject or m.kind}",
                            system="MoldFlow outbox (simulated)", what=f"To {m.to_name} <{m.to_address}>" + (f" on behalf of {m.on_behalf_of}" if m.on_behalf_of else ""),
                            source="simulated"))
    if m.step is not None:
        tenant_pack.on_sent(c, m)


@app.post("/cases/{case_id}/outbox/{mid}/approve")
async def outbox_approve(case_id: str, mid: str, body: DecisionIn) -> CaseOut:
    async with store.editing(case_id) as c:
        m = next((x for x in c.outbox if x.id == mid), None)
        if not m or m.status != "awaiting_approval":
            raise HTTPException(404, "Nothing to approve.")
        if _kill_switch_on():
            raise HTTPException(423, "All outbound is paused (kill switch in the staff header).")
        if body.body and body.body.strip():
            m.body = body.body.strip()
        role = "tenant" if body.by == "tenant" else "owner"
        if role not in m.needs:
            raise HTTPException(403, "This message must be approved by the tenant it is sent for.")
        m.approved_by.append(body.by)
        _send(c, m)
    return CaseOut(case=c)


@app.post("/cases/{case_id}/outbox/{mid}/deny")
async def outbox_deny(case_id: str, mid: str, body: DecisionIn) -> CaseOut:
    async with store.editing(case_id) as c:
        m = next((x for x in c.outbox if x.id == mid), None)
        if not m or m.status != "awaiting_approval":
            raise HTTPException(404, "Nothing to deny.")
        m.status, m.denied_reason = "denied", body.reason or f"Denied by {body.by}"
    return CaseOut(case=c)


class PackStateIn(BaseModel):
    action: str  # pause | resume | landlord_replied


@app.post("/cases/{case_id}/pack/state")
async def pack_state(case_id: str, body: PackStateIn) -> CaseOut:
    async with store.editing(case_id) as c:
        p = c.tenant_pack
        if not p:
            raise HTTPException(404, "No tenant pack on this case.")
        if body.action == "pause":
            p.status = "paused"
        elif body.action == "resume":
            p.status = "active"
            _auto_ladder(c)
        elif body.action == "landlord_replied":
            p.landlord_replied, p.status = True, "resolved"
            c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Landlord replied", system="MoldFlow (simulated)",
                                    what=f"{p.landlord_name} replied and agreed to arrange an inspection. Escalation stopped.", source="simulated"))
            if contact := autopilot.ensure_contact(c):  # tell the tenant right away (routine update, sends on its own)
                from app import messaging
                messaging.create(contact, trigger="reminder", case_id=c.id, drafted_by="rule", is_cem=False, reason="Landlord replied",
                                 body=f"Good news: {p.landlord_name} replied and agreed to arrange an inspection, so we stopped the escalation. "
                                      "Reply here if anything changes.")
        else:
            raise HTTPException(422, "Unknown action.")
    return CaseOut(case=c)


class SkipIn2(BaseModel):
    days: int = 7


@app.post("/demo/skip")
async def demo_skip(body: SkipIn2) -> dict:
    """Demo clock: move time forward; every active tenant pack drafts (and, if authorized, sends) its next step."""
    day = tenant_pack.skip(max(1, min(body.days, 60)))
    drafted = []
    for case in store.list_all():
        if case.tenant_pack and case.tenant_pack.status == "active":
            async with store.editing(case.id) as c:
                if msg := tenant_pack.advance(c):
                    _auto_ladder(c)
                    drafted.append({"case_id": c.id, "message_id": msg.id, "subject": msg.subject, "status": msg.status})
    return {"today": day.isoformat(), "drafted": drafted}


@app.get("/cases/{case_id}/export/ai-report.pdf")
def export_ai_report(case_id: str):
    """The $20 AI pre-assessment report: annotated photos with analysis, in the Mold Busters report format."""
    c = _get(case_id)
    if not any(p.product == "ai_report" for p in c.payments) and c.seeded_from is None:
        raise HTTPException(402, "The full AI report is available after checkout ($20).")
    return Response(render.ai_report_pdf(c), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="ai-report-{case_id}.pdf"'})


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


def _booked_slots(exclude_case: str | None = None) -> set[tuple[date, str]]:
    return {(c.booking.slot_date, c.booking.slot_time) for c in store.list_all()
            if c.booking and c.booking.slot_date and c.booking.slot_time and c.id != exclude_case}


@app.get("/booking/availability")
def booking_availability() -> dict:
    return {"timezone": booking.TIMEZONE, "timezone_label": booking.TIMEZONE_LABEL, "policy": booking.POLICY,
            "tenant_phone": booking.TENANT_PHONE, "customer_types": booking.CUSTOMER_TYPES,
            "tips": [{"amount": a, "label": label} for a, label in booking.TIPS.items()],
            "days": booking.availability(clock.today(), _booked_slots())}


class BookIn(BaseModel):
    service: str
    slot_text: str = "Next available slot"
    customer_type: str | None = None
    slot_date: date | None = None
    slot_time: str | None = None
    contact: BookingContact | None = None
    tip: int | None = None
    notes: str | None = None
    marketing_consent: bool = False  # the unchecked box on the booking form; never pre-checked


@app.post("/cases/{case_id}/book")
async def book(case_id: str, body: BookIn) -> CaseOut:
    paid = body.service == "remote_report"
    slot_text = body.slot_text
    if body.slot_date or body.slot_time:  # on-site visit booked through the form
        if body.customer_type == "tenant":
            raise HTTPException(403, f"Tenants must call us at {booking.TENANT_PHONE} to schedule. Additional fees may apply.")
        if body.customer_type not in booking.BOOKABLE_TYPES:
            raise HTTPException(422, "Tell us who is booking: homeowner, landlord, business or property manager.")
        if not (body.slot_date and body.slot_time) or not booking.is_available(body.slot_date, body.slot_time, clock.today(),
                                                                                _booked_slots(exclude_case=case_id)):
            raise HTTPException(409, "That time was just taken. Please pick another slot.")
        if not body.contact:
            raise HTTPException(422, "Contact details and the property address are required.")
        if body.tip is not None and body.tip not in booking.TIPS:
            raise HTTPException(422, "Tip must be $10, $15 or $25.")
        slot_text = booking.slot_text(body.slot_date, body.slot_time)
    async with store.editing(case_id) as c:
        c.booking = Booking(service=body.service, slot_text=slot_text, status="paid_simulated" if paid else "requested_simulated",
                            customer_type=body.customer_type, slot_date=body.slot_date, slot_time=body.slot_time,
                            timezone=booking.TIMEZONE if body.slot_date else None, contact=body.contact, tip=body.tip,
                            notes=(body.notes or "").strip()[:1000] or None)
        if body.customer_type in booking.CUSTOMER_TYPES:
            c.customer.type = body.customer_type
        if body.contact:
            c.customer.alias = body.contact.name
            c.property.region_text = f"{body.contact.address}, {body.contact.city} {body.contact.postal_code}"
        c.stage = "inspection_booked" if not paid else "report_approved"
        extra = f" · tip ${body.tip}" if body.tip else ""
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="Booked" if not paid else "Remote report purchased",
                                system="MoldFlow (simulated)", what=f"{body.service}: {slot_text}{extra}", source="simulated"))
    from app import hub_links
    if contact := await hub_links.link_booking(c, body.marketing_consent, body.notes):
        if c.contact_id != contact.id:
            async with store.editing(case_id) as c2:
                c2.contact_id = contact.id
            c = c2
    return CaseOut(case=c)


# ---------- inspector ----------
class NoteIn(BaseModel):
    room: str
    text: str


ROOM_WORDS = [("Basement", r"basement|cellar|crawl ?space|sump|furnace"), ("Upstairs washrooms", r"en-?suite|upstairs (wash|bath)room"),
              ("Bathroom", r"bath(room)?|washroom|shower|tub|toilet"), ("Laundry", r"laundry|washer|dryer"), ("Kitchen", r"kitchen|dishwasher"),
              ("Attic", r"attic|roof deck|sheathing|insulation"), ("Bedroom", r"bedroom|closet"), ("Exterior", r"exterior|outside|grading|downspout|gutter")]


def _segments(text: str, default_room: str) -> list[tuple[str, str]]:
    """Split a spoken walkthrough into (room, sentences) as the inspector moves through the house."""
    room, out = default_room, []
    for sent in [x.strip() for x in re.split(r"(?<=[.!?])\s+|\n+", text) if x.strip()]:
        for name, rx in ROOM_WORDS:
            if re.search(rf"\b({rx})\b", sent, re.I):
                room = name
                break
        if out and out[-1][0] == room:
            out[-1] = (room, out[-1][1] + " " + sent)
        else:
            out.append((room, sent))
    return out


async def _transcript_card(case_id: str, room: str, text: str) -> None:
    """An image of the inspector's own words for a room with no photo, filed as inspector evidence (clearly captioned)."""
    import io
    import textwrap
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (900, 600), (255, 247, 240))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 900, 70], fill=(194, 65, 12))
    d.text((24, 24), f"On-site walkthrough · {room} (inspector's words, no photo)", fill=(255, 255, 255))
    y = 100
    for line in textwrap.wrap(text, 95)[:20]:
        d.text((24, y), line, fill=(15, 20, 42))
        y += 24
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    pid = "t" + uuid.uuid4().hex[:6]
    rel = f"uploads/{case_id}/{pid}.jpg"
    (config.DATA_DIR / "uploads" / case_id).mkdir(parents=True, exist_ok=True)
    (config.DATA_DIR / rel).write_bytes(buf.getvalue())
    async with store.editing(case_id) as c:
        c.photos.append(Photo(id=pid, path=rel, room=room, source="inspector", caption_from_pack=f"Walkthrough transcript · {room}"))


@app.post("/cases/{case_id}/onsite/walkthrough")
async def onsite_walkthrough(case_id: str, transcript: str = Form(...), by: str = Form("Inspector"), room: str = Form("General"),
                             video: UploadFile | None = File(None)) -> CaseOut:
    """Inspector's recorded walkthrough -> findings per room (their own words, confirmed) -> report draft, ready for approval."""
    text = transcript.strip()[:20000]
    if len(text) < 10:
        raise HTTPException(422, "The transcript is empty. Speak while recording, or type the notes.")
    vid = None
    if video is not None:
        data = await video.read()
        if data:
            (config.DATA_DIR / "uploads" / case_id).mkdir(parents=True, exist_ok=True)
            vid = f"uploads/{case_id}/walkthrough-{uuid.uuid4().hex[:6]}.webm"
            (config.DATA_DIR / vid).write_bytes(data[:200_000_000])
    new_ids = []
    for seg_room, seg in _segments(text, room):
        c = _get(case_id)
        if not any(p.room == seg_room for p in c.photos):  # no snapshot of this room: the spoken words themselves are the evidence
            await _transcript_card(case_id, seg_room, seg)
            c = _get(case_id)
        if not any(p.room == seg_room for p in c.photos) and c.photos:  # evidence: the walkthrough snapshots for that room, else any photo
            async with store.editing(case_id) as c:
                fallback = next((p for p in reversed(c.photos) if p.source == "inspector"), c.photos[-1])
                if fallback.room is None:
                    fallback.room = seg_room
        found, res = await tasks.findings_from_note(_get(case_id), seg_room, seg)
        if not found and _get(case_id).photos:
            c = _get(case_id)
            ev = [p.id for p in c.photos if p.room == seg_room][:1] or [c.photos[-1].id]
            found = [Finding(id=f"W{len(c.findings) + i + 1}", room=seg_room, observation=d.observation, evidence_photo_ids=ev, source="ai_structured")
                     for i, d in enumerate(tasks.rule_findings(seg_room, seg).findings)]
        async with store.editing(case_id) as c:
            _log(c, res)
            taken = {f.id for f in c.findings}
            for f in found:
                while f.id in taken:
                    f.id = f"W{len(taken) + 1}"
                taken.add(f.id)
                f.confirmed = True  # the inspector's own spoken words
                c.findings.append(f)
                new_ids.append(f.id)
    async with store.editing(case_id) as c:
        c.onsite.append(OnsiteNote(id="o" + uuid.uuid4().hex[:6], kind="walkthrough", by=by, room=room, text=text, video_path=vid, finding_ids=new_ids))
        c.stage = "inspected"
        c.timeline.append(Event(at=now(), at_text=now().strftime("%b %d %H:%M"), step="On-site walkthrough recorded", system="MoldFlow (inspector)",
                                what=f"{by}: {len(new_ids)} findings from the spoken walkthrough" + (" + video" if vid else ""), source="moldflow"))
    if new_ids:
        return await report_draft(case_id)
    return CaseOut(case=_get(case_id))


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
    await _run_autopilot(case_id)
    return CaseOut(case=_get(case_id))


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
    as_of = body.as_of or clock.today()
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
    def load(name: str) -> dict | None:
        f = config.API_DIR / "proof" / name
        return json.loads(f.read_text()) if f.exists() else None

    frames = load("eval_frames.json")
    calls = load("eval_calls.json")
    if calls:  # keep the payload small: scores only, no transcripts
        calls = {k: v for k, v in calls.items() if k != "calls"} | {"calls": [
            {"persona": c["persona"], "backend": c.get("backend"), "prompt": c.get("prompt"), "score": {k: v for k, v in c["score"].items() if k not in ("long_turns",)}}
            for c in calls.get("calls", [])]}
    return {"eval": evald, "frames": {k: v for k, v in (frames or {}).items() if k != "rows"} or None, "calls": calls,
            "usage_by_agent": by_agent, "calls_total": len(usage), "live_calls": len(live), "model": config.PRIMARY_MODEL}


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
    from app import clock
    clock.set_today(None)
    cases = _seed_everything()
    return {"ok": True, "cases": [c.id for c in cases]}
