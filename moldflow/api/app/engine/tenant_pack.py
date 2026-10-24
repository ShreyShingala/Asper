"""$50 tenant action pack: the legal escalation ladder, drafted for the tenant and sent on their behalf (tenant CC'd).

Each step is a deterministic, evidence-based draft (no AI-invented facts, never claims mold is confirmed). Nothing is sent
until the tenant approves it; the owner sees every step and can pause the pack. Wait times between steps run on a demo
clock so the whole ladder can be shown in a minute ("skip 7 days")."""
import uuid
from dataclasses import dataclass
from datetime import date, timedelta

from app.models.passport import Case, OutboxMessage, TenantPack

PRICES = {"ai_report": "20.00", "tenant_pack": "50.00"}
FROM = "care@bustmold.com"

# --- demo clock -------------------------------------------------------------------------------------------------------
_offset_days = 0


def today() -> date:
    return date.today() + timedelta(days=_offset_days)


def skip(days: int) -> date:
    global _offset_days
    _offset_days += days
    return today()


def reset_clock() -> None:
    global _offset_days
    _offset_days = 0


# --- ladder -----------------------------------------------------------------------------------------------------------
@dataclass
class Step:
    n: int
    kind: str
    title: str
    to_role: str
    wait_days: int  # how long to wait for the landlord after this step is sent


def steps_for(case: Case) -> list[Step]:
    s = [Step(1, "landlord_letter", "Letter to your landlord", "landlord", 7),
         Step(2, "formal_notice", "Formal repair request (14-day deadline)", "landlord", 14),
         Step(3, "city_complaint", "Complaint to the city's property standards office", "city", 14)]
    if case.health_flag:
        s.append(Step(len(s) + 1, "public_health", "Letter to the public health unit", "public_health", 7))
    s.append(Step(len(s) + 1, "tribunal", "Tribunal application prep + evidence bundle", "tribunal", 0))
    s.append(Step(len(s) + 1, "councillor", "Letter to your ward councillor", "councillor", 0))
    return s


def _facts(case: Case) -> dict:
    spots = [f"{p.room or case.answers.get('room', 'the unit')}" for p in case.photos if p.source == "customer"]
    obs = [o for p in case.photos if p.analysis for o in p.analysis.observations[:1]][:4]
    province = case.property.province
    room = case.answers.get("room") or next((p.room for p in case.photos if p.source == "customer" and p.room), None) or "unit"
    return {
        "room": room.lower() if room != "Other" else "unit",
        "observations": obs or ["visible discoloration shown in the attached photos"],
        "photos": len([p for p in case.photos if p.source == "customer"]),
        "smell": case.answers.get("odor") == "Yes", "leak": case.answers.get("leak") == "Yes", "health": case.health_flag,
        "tribunal": "Tribunal administratif du logement (TAL)" if province == "QC" else "Landlord and Tenant Board (LTB, form T6)",
        "city": "your municipality's housing inspection service" if province == "QC" else "the City's property standards office (311)",
        "spots": sorted(set(spots)),
    }


def _body(step: Step, case: Case, pack: TenantPack) -> tuple[str, str, str, str]:
    """(to_name, to_address, subject, body)"""
    f = _facts(case)
    t, ll = pack.tenant_name, pack.landlord_name
    obs = "\n".join(f"  - {o}" for o in f["observations"])
    extra = [x for x, on in (("a persistent musty smell", f["smell"]), ("a leak or water damage nearby", f["leak"])) if on]
    reported = (" The tenant also reports " + " and ".join(extra) + ".") if extra else ""
    footer = (f"\n\nSent by Mold Busters on behalf of {t} (copied), who approved this message. These observations come from a "
              "remote pre-assessment and do not confirm mold; only professional sampling can. Replies go to the tenant and to this address.")
    if step.kind == "landlord_letter":
        return (ll, pack.landlord_email, f"Repair request: possible mold in the {f['room']}",
                f"Dear {ll},\n\nI'm writing about visible discoloration in the {f['room']} of my unit, recorded in a Mold Busters remote "
                f"pre-assessment ({f['photos']} photos attached). Observations:\n{obs}\n{reported}\n\nPlease arrange for the area to be "
                f"inspected by a qualified professional and let me know when within 7 days.\n\nThank you,\n{t}" + footer)
    if step.kind == "formal_notice":
        due = (today() + timedelta(days=14)).isoformat()
        return (ll, pack.landlord_email, f"Formal notice: repairs needed by {due}",
                f"Dear {ll},\n\nI wrote on {pack.started_at:%B %d} about possible mold in the {f['room']} and have not received a reply. "
                f"Landlords must keep rental units in a good state of repair. I am formally asking you to have the area inspected and "
                f"the cause of the moisture addressed by {due}.\n\nIf I don't hear from you by then, I will contact {f['city']}.\n\n"
                f"Evidence on file:\n{obs}\n\nRegards,\n{t}" + footer)
    if step.kind == "city_complaint":
        return ("Property standards / housing inspection", "311 / municipal online form", f"Property standards complaint: {f['room']}",
                f"Complainant: {t} (tenant)\nLandlord: {ll} ({pack.landlord_email})\n\nIssue: visible discoloration and possible moisture "
                f"problem in the {f['room']}.{reported}\nLandlord contacted in writing on {pack.started_at:%B %d} and again with a "
                f"formal 14-day notice; no repair arranged.\n\nEvidence: {f['photos']} dated photos, written notices, Mold Busters "
                f"remote pre-assessment (observations only, not a diagnosis).\n\nRequest: an inspection of the unit.")
    if step.kind == "public_health":
        return ("Public health unit (environmental health)", "public health intake", "Housing concern: possible mold and occupant symptoms",
                f"I am a tenant reporting possible mold in my {f['room']} and health symptoms in the household. My landlord ({ll}) "
                f"was notified in writing and has not arranged repairs. I am seeking advice and, if appropriate, an inspection. "
                f"I am also consulting a doctor about the symptoms.\n\n{t}" + footer)
    if step.kind == "tribunal":
        return ("Your application (for you to file)", f"{f['tribunal']}", f"Application prep: {f['tribunal']}",
                f"Prepared for {t} to review and file themselves with the {f['tribunal']}.\n\nSummary of the maintenance issue:\n{obs}"
                f"\n\nTimeline:\n  - {pack.started_at:%B %d}: written repair request to {ll}\n  - formal 14-day notice sent\n"
                f"  - complaint to {f['city']}\n\nAttached evidence bundle: photos with dates, all letters and replies, the pre-assessment."
                "\n\nThis is document preparation, not legal advice. Free tenant legal clinics can help you file.")
    return ("Ward councillor's office", "councillor office email", "Constituent concern: unresolved rental repair",
            f"Dear Councillor,\n\nI'm a tenant in your ward. Since {pack.started_at:%B %d} I have asked my landlord in writing to address "
            f"possible mold in my {f['room']} and have filed a property standards complaint. I would appreciate any help ensuring "
            f"the issue is inspected.\n\nRegards,\n{t}" + footer)


def draft_step(case: Case, n: int) -> OutboxMessage | None:
    pack = case.tenant_pack
    step = next((s for s in steps_for(case) if s.n == n), None)
    if not pack or not step:
        return None
    to_name, to_addr, subject, body = _body(step, case, pack)
    return OutboxMessage(
        id="m" + uuid.uuid4().hex[:7], kind=step.kind, to_role=step.to_role, to_name=to_name, to_address=to_addr,
        channel="form" if step.kind in ("city_complaint", "tribunal") else "email", from_address=FROM,
        on_behalf_of=pack.tenant_name, cc=[pack.tenant_email], subject=subject, body=body, step=n, needs=["tenant"],
        reason=f"Tenant action pack step {n}: {step.title}." + (" The landlord didn't reply in time." if n > 1 else ""))


def start(case: Case, tenant_name: str, tenant_email: str, landlord_name: str, landlord_email: str) -> OutboxMessage:
    case.tenant_pack = TenantPack(tenant_name=tenant_name, tenant_email=tenant_email, landlord_name=landlord_name,
                                  landlord_email=landlord_email)
    msg = draft_step(case, 1)
    case.outbox.append(msg)
    return msg


def on_sent(case: Case, msg: OutboxMessage) -> None:
    """After a ladder step is sent, wait for the landlord."""
    pack = case.tenant_pack
    step = next((s for s in steps_for(case) if s.n == msg.step), None)
    if not pack or not step:
        return
    nxt = step.n + 1
    if nxt > len(steps_for(case)):
        pack.status, pack.next_due = "completed", None
    else:
        pack.step, pack.next_due = nxt, today() + timedelta(days=step.wait_days)


def advance(case: Case) -> OutboxMessage | None:
    """Called when the clock moves: draft the next step if the landlord hasn't replied by the deadline."""
    pack = case.tenant_pack
    if not pack or pack.status != "active" or pack.landlord_replied or not pack.next_due or today() < pack.next_due:
        return None
    if any(m.step == pack.step for m in case.outbox):
        return None
    msg = draft_step(case, pack.step)
    if msg:
        case.outbox.append(msg)
        pack.next_due = None
    return msg


def ladder_view(case: Case) -> list[dict]:
    pack = case.tenant_pack
    out = []
    for s in steps_for(case):
        m = next((m for m in case.outbox if m.step == s.n), None)
        state = ("sent" if m and m.status == "sent_simulated" else "awaiting_you" if m and m.status == "awaiting_approval"
                 else "skipped" if m and m.status == "denied" else "next" if pack and s.n == pack.step else "later")
        out.append({"n": s.n, "title": s.title, "to_role": s.to_role, "state": state, "message_id": m.id if m else None,
                    "due": pack.next_due.isoformat() if pack and pack.next_due and s.n == pack.step else None})
    return out
