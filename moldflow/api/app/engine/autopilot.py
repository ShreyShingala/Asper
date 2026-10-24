"""Autopilot: the system drafts every next action; the owner only approves, edits or denies.

`sync` is idempotent: it looks at a case and drafts what a coordinator would do next (booking offer, estimate follow-up,
sending an approved report). Drafts are deterministic templates over case facts (no invented prices or claims).
`cards` turns everything waiting into one inbox for the owner."""
import uuid

from app.engine import tenant_pack
from app.models.passport import Case, OutboxMessage

# Rough coordinator minutes each automated action replaces (shown as an estimate, not a measurement).
MINUTES = {"booking_offer": 5, "estimate_followup": 6, "report_email": 8, "followup": 6, "report_review": 40,
           "landlord_letter": 15, "formal_notice": 15, "city_complaint": 20, "public_health": 15, "tribunal": 45, "councillor": 10}
KIND_LABEL = {"booking_offer": "Booking offer", "estimate_followup": "Estimate follow-up", "report_email": "Send report",
              "followup": "Follow-up text", "report_review": "Report review"}


def _has(case: Case, kind: str) -> bool:
    return any(m.kind == kind for m in case.outbox)


def _msg(kind: str, case: Case, subject: str, body: str, reason: str, channel: str = "email") -> OutboxMessage:
    return OutboxMessage(id="m" + uuid.uuid4().hex[:7], kind=kind, to_role="customer", to_name=case.customer.alias,
                         to_address=case.customer.contact_simulated or "customer contact on file", channel=channel,
                         subject=subject, body=body, reason=reason, needs=["owner"])


def sync(case: Case) -> list[OutboxMessage]:
    new: list[OutboxMessage] = []
    pa = case.pre_assessment
    name = case.customer.alias if case.customer.alias != "New customer" else "there"
    if pa and not case.booking and pa.recommended_service != "remote_report" and not _has(case, "booking_offer") and case.seeded_from is None:
        tenant = case.customer.type == "tenant"
        body = (f"Hi {name}, thanks for sending your photos to Mold Busters. Based on your pre-assessment we recommend: "
                f"{pa.service_price_text}. " + ("As a tenant, please call us at 1-877-566-6653 to schedule (additional fees may apply)."
                                                if tenant else "You can pick a time online here: https://bustmold.com/book") +
                " Reply here with any questions. - Mold Busters")
        new.append(_msg("booking_offer", case, "Your Mold Busters pre-assessment", body,
                        "New pre-assessment with no booking yet: offer the recommended service.", "sms"))
    est = case.estimate
    if est and est.status in ("sent", "viewed") and not _has(case, "estimate_followup"):
        expires = f" It's valid until {est.expires_on:%B %d}." if est.expires_on else ""
        body = (f"Hi {name}, following up on your Mold Busters estimate ({est.id}, ${est.total:,.2f} incl. tax) for "
                f"{', '.join(est.areas[:3]) or 'the affected areas'}.{expires} Happy to answer questions about the scope or the cause "
                "we found. - Mold Busters")
        new.append(_msg("estimate_followup", case, f"About your estimate {est.id}", body,
                        f"Estimate {est.status}, not accepted yet.", "sms"))
    if case.report and any(a.what == "report" for a in case.approvals) and not _has(case, "report_email"):
        new.append(_msg("report_email", case, "Your Mold Busters report is ready",
                        f"Hi {name}, your inspection report is ready. You'll find it attached, with the photos and our recommendations. "
                        "Reply to this email if you have any questions. - Mold Busters", "Report approved: send it to the client."))
    case.outbox += new
    return new


def cards(cases: list[Case]) -> list[dict]:
    out = []
    for c in cases:
        for m in c.outbox:
            if m.status != "awaiting_approval":
                continue
            owner = "owner" in m.needs
            out.append({"id": m.id, "case_id": c.id, "case_title": c.title, "kind": m.kind, "label": KIND_LABEL.get(m.kind, "Tenant pack"),
                        "title": m.subject or m.kind, "to": f"{m.to_name} <{m.to_address}>", "channel": m.channel, "body": m.body,
                        "reason": m.reason, "action": "approve" if owner else "watch", "created_at": m.created_at.isoformat(),
                        "minutes": MINUTES.get(m.kind, 5)})
        for f in c.followups:
            if f.status == "draft":
                out.append({"id": f.id, "case_id": c.id, "case_title": c.title, "kind": "followup", "label": "Follow-up text",
                            "title": f"Follow-up ({f.channel})", "to": c.customer.alias, "channel": f.channel, "body": f.body,
                            "reason": f.reason, "action": "approve", "created_at": f.created_at.isoformat(), "minutes": MINUTES["followup"]})
        if c.report and not any(a.what == "report" for a in c.approvals):
            out.append({"id": f"review-{c.id}", "case_id": c.id, "case_title": c.title, "kind": "report_review", "label": "Report review",
                        "title": "AI report draft ready for approval", "to": "", "channel": "review",
                        "body": c.report.draft.summary,
                        "reason": f"{len([f for f in c.flags if not f.resolved and f.severity == 'block'])} blocking check(s) open.",
                        "action": "open", "link": f"/cases/{c.id}/review", "created_at": c.report.generated_at.isoformat(),
                        "minutes": MINUTES["report_review"]})
        if c.tenant_pack and c.tenant_pack.status == "active" and c.tenant_pack.next_due:
            out.append({"id": f"pack-{c.id}", "case_id": c.id, "case_title": c.title, "kind": "tenant_pack", "label": "Tenant pack",
                        "title": f"Waiting on {c.tenant_pack.landlord_name} (reply due {c.tenant_pack.next_due})", "to": "", "channel": "info",
                        "body": "", "reason": f"Step {c.tenant_pack.step} drafts automatically if there is no reply by the deadline "
                        f"(today: {tenant_pack.today()}).", "action": "watch", "created_at": c.tenant_pack.started_at.isoformat(), "minutes": 0})
    return sorted(out, key=lambda x: (x["action"] != "approve", x["created_at"]), reverse=False)
