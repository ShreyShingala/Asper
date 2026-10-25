"""Muse: the company assistant with context from every project (timeline, chat, findings, checks, messages, estimates,
approvals, payments). It answers with citations and can act, but only through the approval queue: drafted messages
go to the Hub's Outreach queue, and read-only actions (evidence bundle, open a project) run immediately."""
import json
import re
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.llm import AgentFailure, structured
from app.models.passport import Case

_WORD = re.compile(r"[a-z0-9]{3,}")
_STOP = {"the", "and", "for", "with", "that", "this", "from", "have", "can", "you", "give", "what", "was", "are", "about", "case",
         "project", "please", "need", "any", "all", "our", "who", "how", "when", "did", "does", "there", "issue", "issues"}
LEGAL = re.compile(r"\b(legal|lawyer|court|sue|claim|defen[cs]e|dispute|documentation|evidence|refund|complaint)\b", re.I)


class MuseAction(BaseModel):
    type: Literal["draft_message", "evidence_bundle", "open_project"]
    case_id: str
    label: str = Field(description="Button text, e.g. 'Draft reply to the client'")
    to_role: Literal["customer", "landlord", "staff"] = "customer"
    subject: str = ""
    body: str = Field(default="", description="For draft_message: the full message text")


class MuseAnswer(BaseModel):
    answer: str = Field(description="Direct answer in plain language, 2-8 sentences, only from the snippets")
    cites: list[str] = Field(default=[], description="Snippet refs used, e.g. 'case42/timeline/3'")
    actions: list[MuseAction] = Field(default=[], description="0-3 useful next actions")


SYSTEM = """You are Muse, the internal assistant for Mold Busters (mold inspection and remediation). You have snippets from
the company's project records (timelines, project chats, findings, checks, messages, estimates, approvals, payments)
and customer profiles (people, interactions across tools, texts and emails, approved facts).
Answer ONLY from the snippets and cite their refs. If something isn't in the snippets, say so. Never invent dates, prices
or facts, never claim mold is confirmed, and never give legal advice (you can organise documentation for a lawyer).
Offer up to 3 actions: draft_message (a message the owner will approve before it is sent), evidence_bundle (a downloadable
dated bundle of everything on a project, for a lawyer or insurer), open_project. Use the case ids from the snippets."""


def _tok(s: str) -> set[str]:
    return {w for w in _WORD.findall(s.lower()) if w not in _STOP}


def snippets(case: Case) -> list[tuple[str, str]]:
    out = [(f"{case.id}/summary", f"{case.title} | project #{case.project_no or '-'} | stage {case.stage} | customer {case.customer.type} "
                                  f"{case.customer.alias} | concern: {case.concern}")]
    out += [(f"{case.id}/timeline/{i}", f"{e.at_text} {e.step} ({e.system}): {e.what}") for i, e in enumerate(case.timeline)]
    out += [(f"{case.id}/chat/{m.id}", f"{m.at:%Y-%m-%d} {m.author}: {m.text}") for m in case.chat]
    out += [(f"{case.id}/finding/{f.id}", f"Finding {f.room}: {f.observation}") for f in case.findings]
    out += [(f"{case.id}/check/{f.id}", f"Check ({f.severity}{', resolved' if f.resolved else ''}): {f.message}") for f in case.flags]
    out += [(f"{case.id}/message/{m.id}", f"{m.status} {m.kind} to {m.to_name}: {m.subject} | {m.body[:300]}") for m in case.outbox]
    out += [(f"{case.id}/approval/{i}", f"{a.what} approved by {a.reviewed_by} on {a.at:%Y-%m-%d}") for i, a in enumerate(case.approvals)]
    out += [(f"{case.id}/payment/{p.id}", f"Payment {p.product} ${p.amount} ({p.status}) on {p.at:%Y-%m-%d}") for p in case.payments]
    if case.estimate:
        e = case.estimate
        out.append((f"{case.id}/estimate", f"Estimate {e.id}: ${e.total} incl. tax, status {e.status}, areas {', '.join(e.areas)}"))
    if case.pre_assessment:
        out.append((f"{case.id}/pre_assessment", f"Pre-assessment: {case.pre_assessment.summary} {case.pre_assessment.service_price_text}"))
    if case.live and case.live.summary:
        out.append((f"{case.id}/live_call", f"Live call summary: {case.live.summary}"))
    return out


def people_snippets() -> list[tuple[str, str, str]]:
    """(person name, ref, text) from the Hub: contacts, interactions, messages, approved facts. Health facts and anything
    marked never-use stay out, the same rule the Hub applies to drafting."""
    from app import crm_store as db
    from app.models.crm import Contact, Interaction, Message, ProfileFact
    out = []
    for c in db.query(Contact):
        out.append((c.name, f"person/{c.id}", f"Person {c.name} ({c.customer_type}, {c.language}{', synthetic demo' if c.synthetic else ''}) "
                                              f"cases {', '.join(c.case_ids) or 'none'}; conversation owner {c.owner}"))
    names = {c.id: c.name for c in db.query(Contact)}
    for i in db.query(Interaction):
        out.append((names.get(i.contact_id, ""), f"person/{i.contact_id}/interaction/{i.id}", f"{i.at:%Y-%m-%d} {i.system} {i.kind}: {i.summary}"))
    for msg in db.query(Message):
        if msg.status in ("sent_simulated", "received", "draft"):
            who = "customer wrote" if msg.direction == "in" else f"we {msg.status.replace('_simulated', '')}"
            out.append((names.get(msg.contact_id, ""), f"person/{msg.contact_id}/message/{msg.id}", f"{msg.created_at:%Y-%m-%d} {who}: {msg.body[:300]}"))
    for f in db.query(ProfileFact, status="approved"):
        if f.category != "health" and f.message_use != "never":
            out.append((names.get(f.contact_id, ""), f"person/{f.contact_id}/fact/{f.id}", f"Fact: {f.text}"))
    return out


def retrieve(question: str, cases: list[Case], scope: str | None = None, k: int = 28) -> list[tuple[str, str]]:
    q = _tok(question)
    nums = {int(n) for n in re.findall(r"\b(?:case|project|#)\s*(\d{1,4})\b", question.lower())}
    scored = []
    for c in cases:
        if scope and c.id != scope:
            continue
        boost = 6 if (c.project_no in nums or (scope and c.id == scope)) else 0
        for ref, text in snippets(c):
            s = len(q & _tok(text)) + boost
            if s:
                scored.append((s, ref, text))
    if not scope:
        for name, ref, text in people_snippets():
            boost = 4 if name and any(part.lower() in question.lower() for part in name.split() if len(part) > 2) else 0
            if (s := len(q & _tok(text)) + boost):
                scored.append((s, ref, text))
    scored.sort(key=lambda x: -x[0])
    return [(r, t) for _, r, t in scored[:k]]


def _person_answer(question: str, cases: list[Case]) -> MuseAnswer | None:
    """Questions naming a customer ('what's going on with Priya?') or about follow-ups, answered straight from the records."""
    from app import crm_store as db
    from app.models.crm import Contact, Message, Moment, ProfileFact
    q = question.lower()
    people = db.query(Contact)
    if re.search(r"follow.?ups?|who (do|should) (i|we) (call|text|contact)|due", q) and not any(
            part.lower() in q for c in people for part in c.name.split() if len(part) > 3 and part.lower() not in ("sample", "client")):
        names = {c.id: c.name for c in people}
        due = sorted(db.query(Moment, status="upcoming"), key=lambda m: m.due)[:8]
        if due:
            return MuseAnswer(answer="Upcoming follow-ups:\n" + "\n".join(f"- {m.due:%b %d}: {names.get(m.contact_id, '?')}: {m.reason}" for m in due),
                              cites=[f"person/{m.contact_id}" for m in due])
    for c in people:
        parts = [x.lower() for x in c.name.replace("(", " ").split() if len(x) > 3 and x.lower() not in ("sample", "client", "homeowner", "tenant")]
        if c.case_ids and c.case_ids[0] in ("job1", "job2") and (c.case_ids[0] in q or ("job 1" in q and c.case_ids[0] == "job1") or ("job 2" in q and c.case_ids[0] == "job2")):
            parts.append(c.case_ids[0])
        if not any(x in q for x in parts):
            continue
        case = next((k for k in cases if k.id in c.case_ids), None)
        msgs = sorted([m for m in db.query(Message, contact_id=c.id) if m.status in ("received", "sent_simulated")], key=lambda m: m.created_at)
        facts = [f for f in db.query(ProfileFact, contact_id=c.id, status="approved") if f.category != "health" and f.message_use != "never"]
        nxt = next(iter(sorted(db.query(Moment, contact_id=c.id, status="upcoming"), key=lambda m: m.due)), None)
        last_in = next((m for m in reversed(msgs) if m.direction == "in"), None)
        lines = [f"{c.name} ({c.customer_type.replace('_', ' ')}, {c.properties[0].city if c.properties else ''})."]
        if case:
            lines.append(f"Case #{case.project_no or case.id}: {case.concern} Stage: {case.stage.replace('_', ' ')}."
                         + (f" Visit: {case.booking.slot_text}." if case.booking and case.booking.slot_date else "")
                         + (f" Estimate {case.estimate.id}: ${case.estimate.total:,.2f} ({case.estimate.status})." if case.estimate else "")
                         + f" {len(case.photos)} photos, {len(case.findings)} findings.")
        if last_in:
            lines.append(f"Last thing they said ({last_in.created_at:%b %d}): \"{last_in.body}\"")
        if facts:
            lines.append("Worth knowing: " + "; ".join(f.text for f in facts[:4]) + ".")
        if nxt:
            lines.append(f"Next follow-up {nxt.due:%b %d}: {nxt.reason}.")
        drafts = [m for m in db.query(Message, contact_id=c.id, status="draft")]
        if drafts:
            lines.append(f"A reply is drafted and waiting for your OK: \"{drafts[0].body[:140]}\"")
        acts = [MuseAction(type="open_project", case_id=case.id, label="Open the project")] if case else []
        if case and LEGAL.search(question):
            acts.insert(0, MuseAction(type="evidence_bundle", case_id=case.id, label="Download the evidence bundle"))
        return MuseAnswer(answer="\n".join(lines), cites=[f"person/{c.id}"] + ([f"{case.id}/summary"] if case else []), actions=acts)
    return None


def _fallback(question: str, hits: list[tuple[str, str]], cases: list[Case]) -> MuseAnswer:
    if (pa := _person_answer(question, cases)) and not re.search(r"\bcase\s*42\b", question.lower()):
        return pa
    if not hits:
        return MuseAnswer(answer="I couldn't find anything about that in the project records.")
    cid = next((r.split("/")[0] for r, _ in hits if not r.startswith("person/")), hits[0][0].split("/")[0])
    case = next((c for c in cases if c.id == cid), None)
    legal = bool(LEGAL.search(question))
    mine = [(r, t) for r, t in hits if r.startswith(cid + "/")]
    if legal and case:
        dated = "\n".join(f"- {e.at_text}: {e.step}. {e.what}" for e in case.timeline)
        approvals = "; ".join(f"{a.what} approved by {a.reviewed_by} ({a.at:%b %d, %Y})" for a in case.approvals) or "none recorded"
        answer = (f"{case.title}. Documented history, in order:\n{dated}\n\nApprovals: {approvals}. The project chat has "
                  f"{len(case.chat)} messages. The evidence bundle packages all of it (record, timeline, chat, messages, approvals, "
                  "reports and photos) with a fingerprint per file for your lawyer. This is documentation, not legal advice.")
        cites = [f"{cid}/timeline/{i}" for i in range(len(case.timeline))]
    else:
        answer = "Here is what the records show:\n" + "\n".join(f"- {t}" for _, t in (mine or hits)[:8])
        cites = [r for r, _ in (mine or hits)[:8]]
    acts = [MuseAction(type="evidence_bundle", case_id=cid, label="Download the evidence bundle")] if legal else []
    acts.append(MuseAction(type="open_project", case_id=cid, label="Open the project"))
    return MuseAnswer(answer=answer, cites=cites, actions=acts)


async def ask(question: str, cases: list[Case], scope: str | None = None) -> tuple[MuseAnswer, list[tuple[str, str]]]:
    if not scope and re.search(r"follow.?ups?|who (do|should) (i|we) (call|text|contact|follow)", question, re.I) and (pa := _person_answer(question, cases)):
        return pa, []  # the follow-up queue is exact data: answer from it, not from a model's reading of it
    hits = retrieve(question, cases, scope)
    if not hits:
        return _fallback(question, hits, cases), hits
    try:
        res = await structured(MuseAnswer, agent="muse", system=SYSTEM, temperature=0.2, max_tokens=900,
                               user_text=json.dumps({"question": question, "snippets": [{"ref": r, "text": t} for r, t in hits]}))
        ans: MuseAnswer = res.value
    except AgentFailure:
        ans = _fallback(question, hits, cases)
    known = {c.id for c in cases}
    ans.actions = [a for a in ans.actions if a.case_id in known][:3]
    if LEGAL.search(question) and not any(a.type == "evidence_bundle" for a in ans.actions):
        if cid := next((r.split("/")[0] for r, _ in hits if not r.startswith("person/")), None):
            ans.actions.insert(0, MuseAction(type="evidence_bundle", case_id=cid, label="Download the evidence bundle"))
    ans.cites = [c for c in ans.cites if any(c == r for r, _ in hits)]
    return ans, hits
