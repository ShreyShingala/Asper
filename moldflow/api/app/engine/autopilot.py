"""Autopilot: drafts every next customer message from the case and hands it to the Hub's sending gate
(messaging.create -> autonomy -> consent.check -> footer). Routine messages (booking offer, report ready) are 'auto' and
send themselves; anything with money or personal facts stays locked for a person; the kill switch stops everything.

Case -> Contact: a customer who started a pre-assessment and left a phone or email has made an inquiry, which gives
6 months of implied consent under CASL (same rule the Hub uses for bookings)."""
import re

from app import clock, crm_store as db, messaging
from app.engine import consent, geo
from app.models.crm import ChannelConsent, Contact, Interaction, Message, PropertyRef
from app.models.passport import Case


def _find(phone: str, email: str) -> Contact | None:
    digits = re.sub(r"\D", "", phone or "")[-10:]
    for c in db.query(Contact):
        if digits and any(re.sub(r"\D", "", p)[-10:] == digits for p in c.phones):
            return c
        if email and email.lower() in (e.lower() for e in c.emails):
            return c
    return None


def ensure_contact(case: Case, name: str | None = None, phone: str | None = None, email: str | None = None) -> Contact | None:
    """The person behind a case, created from the basic fields entered in the app (or the tenant pack / booking)."""
    tp, bc = case.tenant_pack, (case.booking.contact if case.booking else None)
    name = name or (bc.name if bc else None) or (tp.tenant_name if tp else None)
    phone = phone or (bc.phone if bc else "")
    email = email or (bc.email if bc else "") or (tp.tenant_email if tp else "")
    c = (db.get(Contact, case.contact_id) if case.contact_id else None) or _find(phone, email)
    if not c and not (phone or email):
        return None
    if not c:
        c = Contact(id=db.new_id("c-"), name=name or "New customer", tags=["pre-assessment"])
    if name:
        c.name = name
    if phone and phone not in c.phones:
        c.phones.insert(0, phone)
    if email and email not in c.emails:
        c.emails.insert(0, email)
    c.language = case.language
    if case.customer.type != "unknown":
        c.customer_type = case.customer.type
    postal = case.answers.get("location", "")
    if (fsa := geo.fsa_of(postal)) and not any(p.fsa == fsa for p in c.properties):
        loc = geo.locate(postal)
        c.properties.insert(0, PropertyRef(postal=postal.upper(), fsa=fsa, lat=loc[0] if loc else None, lon=loc[1] if loc else None,
                                           province=case.property.province if case.property.province in ("ON", "QC") else "unknown"))
    if case.id not in c.case_ids:
        c.case_ids.append(case.id)
    today = clock.today()
    for ch in ("sms", "email"):
        cur: ChannelConsent = getattr(c.consent, ch)
        if cur.basis == "none" and not cur.opt_out_at:
            setattr(c.consent, ch, ChannelConsent(basis="implied_inquiry", granted_at=today, implied_until=consent.implied_until("implied_inquiry", today),
                                                  granted_via="web_form", evidence_ref=f"pre-assessment {case.id}"))
    c.prefs.channel = "sms" if phone else "email"
    db.put(c)
    if not any(i.case_id == case.id and i.kind == "pre_assessment" for i in db.query(Interaction, contact_id=c.id)):
        db.put(Interaction(id=db.new_id("i"), contact_id=c.id, case_id=case.id, at=clock.now(), system="moldflow", kind="pre_assessment",
                           summary=(case.pre_assessment.summary[:160] if case.pre_assessment else "Started a pre-assessment")))
    case.contact_id = c.id
    return c


def _done(case: Case, trigger: str) -> bool:
    return any(m.trigger == trigger for m in db.query(Message, contact_id=case.contact_id or "-") if m.case_id == case.id)


def sync(case: Case) -> list[Message]:
    """Idempotent: draft (and, where autonomy allows, send) what a coordinator would do next for this case."""
    if not case.contact_id or not (contact := db.get(Contact, case.contact_id)):
        return []
    out = []
    pa = case.pre_assessment
    first = contact.name.split()[0] if contact.name and contact.name != "New customer" else "there"
    if pa and not case.booking and pa.recommended_service != "remote_report" and not _done(case, "booking_offer"):
        tenant = case.customer.type == "tenant"
        body = (f"Hi {first}, thanks for your photos. Based on your pre-assessment we recommend: {pa.service_price_text}. "
                + ("As a tenant, please call 1-877-566-6653 to book (additional fees may apply)." if tenant
                   else "Pick a time here: {booking_link}") + " Questions? Just reply.")
        out.append(messaging.create(contact, trigger="booking_offer", body=body, reason="New pre-assessment, no booking yet", drafted_by="rule",
                                    case_id=case.id, is_cem=not tenant))
    if case.report and any(a.what == "report" for a in case.approvals) and not _done(case, "report_ready"):
        out.append(messaging.create(contact, trigger="report_ready", subject="Your Mold Busters report is ready", channel="email",
                                    body=f"Hi {first}, your inspection report is ready, with the photos and our recommendations. "
                                         "Reply to this email with any questions.", reason="Report approved", drafted_by="rule",
                                    case_id=case.id, is_cem=False))
    return out
