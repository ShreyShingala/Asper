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

from app import config, store
from app.engine import muse, photo_plan
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
                msg = muse.to_outbox(c, a)
                c.outbox.append(msg)
            results.append({"type": a.type, "label": a.label, "case_id": a.case_id, "status": "Waiting for your approval in Autopilot",
                            "message_id": msg.id, "body": msg.body})
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
