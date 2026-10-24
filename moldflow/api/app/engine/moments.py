"""Reasons to reach out, computed from facts, estimates and the calendar. Revenue-linked moments first (estimate expiry,
post-remediation check); personal moments come from fact follow-up hooks. Moments built from household facts (children,
babies) are human talking points only, never automated messages.
Why household moments are human-only: docs/04_decisions.md D9."""
from datetime import date, timedelta

from app import clock
from app.models.crm import Contact, Interaction, Moment, ProfileFact

HORIZON = timedelta(days=60)


def _id(contact_id: str, kind: str, key: str) -> str:
    return f"m-{contact_id}-{kind}-{key}"[:80]


def compute(contact: Contact, facts: list[ProfileFact], interactions: list[Interaction], today: date | None = None) -> list[Moment]:
    today = today or clock.today()
    out: list[Moment] = []
    for it in interactions:
        if it.kind != "estimate":
            continue
        status = it.meta.get("status")
        issued = it.at.date()
        expiry = issued + timedelta(days=60)
        if status in ("sent", "viewed") and today <= expiry:
            due = max(today, expiry - timedelta(days=14)) if status == "viewed" else today
            out.append(Moment(id=_id(contact.id, "estimate_expiry", it.meta.get("number", it.id)), contact_id=contact.id, kind="estimate_expiry",
                              due=due, case_id=it.case_id,
                              reason=f"Estimate {it.meta.get('number', '')} (${it.amount:,.2f}) {status}, not accepted; valid until {expiry.isoformat()}"))
        if status == "accepted":
            check = issued + timedelta(days=365)
            if today <= check <= today + HORIZON * 6:
                out.append(Moment(id=_id(contact.id, "post_remediation_check", it.meta.get("number", it.id)), contact_id=contact.id,
                                  kind="post_remediation_check", due=check - timedelta(days=14), case_id=it.case_id,
                                  reason="One year since remediation: offer the follow-up clearance check"))
    for f in facts:
        if f.status != "approved" or not f.follow_up:
            continue
        human = f.category in ("household", "health") or f.message_use == "never"
        kind = "back_to_school" if "school" in f.text.lower() else "nursery_humidity" if "baby" in f.text.lower() else "fact_follow_up"
        out.append(Moment(id=_id(contact.id, kind, f.id), contact_id=contact.id, kind=kind, due=f.follow_up, source_fact_id=f.id,
                          reason=f.follow_up_reason or f.text, human_only=human))
    return out
