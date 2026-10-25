"""Projects, project chat, Muse (company assistant), evidence bundle and Telegram import."""
import hashlib
import io
import json
import re
import uuid
import zipfile
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app import config, messaging, store
from app.engine import autopilot, muse, photo_plan
from app.exports import render
from app.models.passport import Case, ChatMessage, Photo, now

router = APIRouter()


def _get(case_id: str) -> Case:
    if not (c := store.get(case_id)):
        raise HTTPException(404, "case not found")
    return c


def _photo_file(p: Photo):
    for base in (config.DATA_DIR, config.PACK_DIR):
        if (base / p.path).is_file():
            return base / p.path
    return None


@router.get("/projects")
def projects_list() -> list[dict]:
    out = []
    for c in store.list_all():
        last = max([e.at for e in c.timeline if e.at] + [m.at for m in c.chat] + [c.created_at])
        out.append({"id": c.id, "project_no": c.project_no, "title": c.title, "stage": c.stage, "customer": c.customer.alias,
                    "customer_type": c.customer.type, "photos": len(c.photos), "chat": len(c.chat), "mock": c.seeded_from == "mock",
                    "pending": sum(1 for m in c.outbox if m.status == "awaiting_approval"), "last_activity": last.isoformat()})
    return sorted(out, key=lambda x: x["last_activity"], reverse=True)


@router.get("/projects/{case_id}")
def project_detail(case_id: str) -> dict:
    c = _get(case_id)
    titles = {s.id: s.title for s in (photo_plan.plan_for_case(c.answers) or [])}
    groups: dict[str, list[str]] = {}
    for p in c.photos:
        key = (titles[p.prompt_id].split(" · ", 1)[-1] if p.prompt_id in titles else None) or p.room or "Unsorted"
        groups.setdefault(key, []).append(p.id)
    docs = []
    if c.pre_assessment:
        docs.append({"title": "Pre-assessment (PDF)", "href": f"/api/cases/{c.id}/export/pre-assessment.pdf", "kind": "pdf"})
    if c.report:
        docs.append({"title": "Inspection report (PDF)", "href": f"/api/cases/{c.id}/export/report.pdf", "kind": "pdf"})
    docs += [{"title": f"Sent: {m.subject or m.kind}", "kind": "message", "at": m.sent_at.isoformat() if m.sent_at else None, "body": m.body}
             for m in c.outbox if m.status == "sent_simulated"]
    docs += [{"title": f"Receipt: {p.product.replace('_', ' ')} ${p.amount}", "kind": "receipt", "at": p.at.isoformat()} for p in c.payments]
    if c.estimate:
        docs.append({"title": f"Estimate {c.estimate.id} · ${c.estimate.total:,.2f} · {c.estimate.status}", "kind": "estimate"})
    return {"case": c, "media": groups, "shot_titles": titles, "documents": docs, "evidence_href": f"/api/projects/{c.id}/evidence.zip"}


class ChatIn(BaseModel):
    text: str
    author: str = "Owner"


@router.post("/projects/{case_id}/chat")
async def project_chat(case_id: str, body: ChatIn) -> dict:
    """Post to the project chat. Mention @muse (or @bruce) to get an answer with this project's full context."""
    text = body.text.strip()[:2000]
    if not text:
        raise HTTPException(422, "Empty message.")
    async with store.editing(case_id) as c:
        c.chat.append(ChatMessage(id="c" + uuid.uuid4().hex[:7], author=body.author, role="staff", text=text))
    reply = None
    if re.search(r"@(muse|bruce|ai)\b", text, re.I):
        ans, _ = await muse.ask(re.sub(r"@(muse|bruce|ai)\b", "", text, flags=re.I), store.list_all(), scope=case_id)
        async with store.editing(case_id) as c:
            reply = ChatMessage(id="c" + uuid.uuid4().hex[:7], author="Muse", role="ai", text=ans.answer)
            c.chat.append(reply)
    return {"chat": _get(case_id).chat, "reply": reply}


class MuseIn(BaseModel):
    question: str
    case_id: str | None = None


@router.post("/muse/ask")
async def muse_ask(body: MuseIn) -> dict:
    """Company assistant. Drafted messages go into the Autopilot inbox for approval; nothing is sent from here."""
    ans, hits = await muse.ask(body.question[:1000], store.list_all(), scope=body.case_id)
    results = []
    for a in ans.actions:
        if a.type == "draft_message":
            async with store.editing(a.case_id) as c:
                contact = autopilot.ensure_contact(c)
                if not contact:
                    results.append({"type": a.type, "label": a.label, "case_id": a.case_id, "status": "No phone or email on file for this project",
                                    "body": a.body})
                    continue
                msg = messaging.create(contact, trigger="muse_draft", body=a.body or a.label, subject=a.subject or None, case_id=c.id,
                                       reason="Drafted by Muse at the owner's request", drafted_by="ai", is_cem=False)
            results.append({"type": a.type, "label": a.label, "case_id": a.case_id, "status": "Waiting for your OK in Outreach",
                            "message_id": msg.id, "body": msg.body, "href": "/outreach"})
        elif a.type == "evidence_bundle":
            results.append({"type": a.type, "label": a.label, "case_id": a.case_id, "href": f"/api/projects/{a.case_id}/evidence.zip"})
        else:
            results.append({"type": a.type, "label": a.label, "case_id": a.case_id, "href": f"/projects/{a.case_id}"})
    snip = dict(hits)
    return {"answer": ans.answer, "cites": [{"ref": r, "text": snip.get(r, "")} for r in ans.cites], "actions": results}


@router.get("/projects/{case_id}/evidence.zip")
def evidence_bundle(case_id: str):
    """Everything on a project, dated, with a SHA-256 per file, for a lawyer or insurer."""
    c = _get(case_id)
    files: dict[str, bytes] = {
        "case_record.json": c.model_dump_json(indent=2).encode(),
        "timeline.txt": "\n".join(f"{e.at_text}\t{e.step}\t{e.system}\t{e.what}" for e in c.timeline).encode(),
        "project_chat.txt": "\n".join(f"{m.at:%Y-%m-%d %H:%M}\t{m.author}\t{m.text}\t[{m.source}]" for m in c.chat).encode(),
        "messages.txt": "\n\n".join(f"{m.status} {m.sent_at or m.created_at}\nTo: {m.to_name} <{m.to_address}>\nSubject: {m.subject}\n\n{m.body}"
                                    for m in c.outbox).encode(),
        "approvals.txt": "\n".join(f"{a.at:%Y-%m-%d %H:%M}\t{a.what}\tapproved by {a.reviewed_by}" for a in c.approvals).encode(),
    }
    if c.pre_assessment:
        files["pre-assessment.pdf"] = render.pre_assessment_pdf(c)
    if c.report:
        files["report.pdf"] = render.report_pdf(c)
    for p in c.photos:
        if f := _photo_file(p):
            files[f"photos/{p.id}_{f.name}"] = f.read_bytes()
    manifest = [f"Evidence bundle for {c.title} ({c.id}), generated {now():%Y-%m-%d %H:%M}.",
                "Each file's SHA-256 lets anyone check it hasn't been changed since this bundle was made.", ""]
    manifest += [f"{hashlib.sha256(b).hexdigest()}  {name}" for name, b in files.items()]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, b in files.items():
            z.writestr(name, b)
        z.writestr("MANIFEST.txt", "\n".join(manifest))
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="evidence-{c.id}.zip"'})


@router.post("/projects/{case_id}/import-telegram")
async def import_telegram(case_id: str, file: UploadFile = File(...)) -> dict:
    """Telegram Desktop export (result.json: {name, messages:[{type, date, from, text}]}) -> project chat messages."""
    try:
        data = json.loads((await file.read()).decode("utf-8"))
    except Exception:
        raise HTTPException(400, "That isn't a Telegram Desktop JSON export (result.json).")
    added = 0
    async with store.editing(case_id) as c:
        seen = {(m.at, m.author, m.text) for m in c.chat}
        for msg in data.get("messages", []):
            text = msg.get("text")
            if isinstance(text, list):
                text = "".join(t if isinstance(t, str) else t.get("text", "") for t in text)
            if msg.get("type") != "message" or not text:
                continue
            try:
                at = datetime.fromisoformat(msg["date"])
            except Exception:
                continue
            key = (at, msg.get("from") or "Unknown", text)
            if key not in seen:
                seen.add(key)
                c.chat.append(ChatMessage(id="c" + uuid.uuid4().hex[:7], author=key[1], role="staff", text=text, at=at, source="telegram"))
                added += 1
        c.chat.sort(key=lambda m: m.at)
    return {"imported": added, "chat_name": data.get("name"), "total": len(_get(case_id).chat)}


@router.get("/hub/pillars")
def hub_pillars() -> dict:
    """The admin dashboard's three pillars: customer conversations, virtual assessments, on-site reviews. Each item says what
    the system did and what (if anything) is waiting for Approve / Deny."""
    from app import crm_store as db
    from app.models.crm import Contact, Message
    contacts = {c.id: c for c in db.query(Contact)}
    msgs = db.query(Message)
    convs = []
    for cid, c in contacts.items():
        thread = sorted([m for m in msgs if m.contact_id == cid and m.status in ("received", "sent_simulated", "draft")], key=lambda m: m.created_at)
        if not any(m.direction == "in" for m in thread):
            continue
        draft = next((m for m in reversed(thread) if m.status == "draft"), None)
        convs.append({"contact_id": cid, "name": c.name, "language": c.language, "synthetic": c.synthetic, "owner": c.owner,
                      "case_id": next(iter(c.case_ids), None), "last_at": thread[-1].created_at.isoformat(),
                      "thread": [{"id": m.id, "dir": m.direction, "text": m.body, "at": m.created_at.isoformat(), "status": m.status}
                                 for m in thread if m.status != "draft"][-6:],
                      "draft": {"id": draft.id, "body": draft.body.replace("{booking_link}", messaging.booking_link(c, draft.id)), "reason": draft.reason, "autonomy": draft.autonomy} if draft else None})
    convs = sorted(convs, key=lambda x: (x["draft"] is None, x["language"] == "fr", -datetime.fromisoformat(x["last_at"]).timestamp()))
    cases = store.list_all()
    virtual = []
    for c in cases:
        if c.intake_mode != "live" and not any(p.source == "customer" for p in c.photos):
            continue
        if c.seeded_from in ("mock",) or c.id.startswith(("conv-", "visit-")):
            continue
        pending = [m for m in msgs if m.case_id == c.id and m.status == "draft"]
        virtual.append({"case_id": c.id, "title": c.title, "stage": c.stage, "photos": sum(1 for p in c.photos if p.source == "customer"),
                        "service": c.pre_assessment.service_price_text if c.pre_assessment else None,
                        "summary": c.live.summary if c.live and c.live.summary else (c.pre_assessment.summary if c.pre_assessment else None),
                        "paid": [p.product for p in c.payments], "tenant_pack": c.tenant_pack.status if c.tenant_pack else None,
                        "photo_ids": [p.id for p in c.photos if p.source == "customer"][:4],
                        "pending": [{"id": m.id, "body": m.body.replace("{booking_link}", "https://bustmold.com/book/MB-" + m.id[-4:].upper()), "reason": m.reason} for m in pending], "created_at": c.created_at.isoformat()})
    virtual.sort(key=lambda x: x["created_at"], reverse=True)
    onsite = []
    for c in cases:
        if not (c.onsite or c.report or any(p.source == "inspector" for p in c.photos)):
            continue
        approved = any(a.what == "report" for a in c.approvals)
        onsite.append({"case_id": c.id, "title": c.title, "stage": c.stage, "notes": len(c.onsite), "findings": len(c.findings),
                       "inspector_photos": sum(1 for p in c.photos if p.source == "inspector"),
                       "last_note": c.onsite[-1].text[:220] if c.onsite else None, "has_video": any(o.video_path for o in c.onsite),
                       "report": "approved" if approved else "draft" if c.report else "none",
                       "blocks": [f.message for f in c.open_blocks()], "summary": c.report.draft.summary if c.report else None})
    return {"conversations": convs[:10], "virtual": virtual[:8], "onsite": onsite[:8],
            "counts": {"replies_waiting": sum(1 for x in convs if x["draft"]), "virtual_waiting": sum(len(v["pending"]) for v in virtual),
                       "reports_waiting": sum(1 for o in onsite if o["report"] == "draft")}}
