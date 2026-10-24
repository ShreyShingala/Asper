"""Keep the relationship hub in step with the case flow: a booking creates/updates the person's Contact (consent recorded
exactly as given on the form), and free-text the customer wrote becomes grounded facts."""
import re
from datetime import timedelta

from app import clock, crm_store as db, messaging
from app.agents import hub as agents
from app.engine import consent, geo
from app.models.crm import ChannelConsent, Contact, Interaction, PropertyRef
from app.models.passport import Case

CONSENT_TEXT_VERSION = "2026-10-booking-v1"


def _find(phone: str, email: str) -> Contact | None:
    digits = re.sub(r"\D", "", phone)[-10:]
    for c in db.query(Contact):
        if digits and any(re.sub(r"\D", "", p)[-10:] == digits for p in c.phones):
            return c
        if email and email.lower() in (e.lower() for e in c.emails):
            return c
    return None


async def link_booking(case: Case, marketing_consent: bool, notes: str | None) -> Contact | None:
    b = case.booking
    if not b or not b.contact:
        return None
    bc = b.contact
    c = _find(bc.phone, bc.email) or (db.get(Contact, case.contact_id) if case.contact_id else None)
    if not c:
        c = Contact(id=db.new_id("c-"), name=bc.name, tags=["booked online"])
    c.name = bc.name
    if bc.phone and bc.phone not in c.phones:
        c.phones.insert(0, bc.phone)
    if bc.email and bc.email not in c.emails:
        c.emails.insert(0, bc.email)
    c.language = case.language
    if case.customer.type in ("homeowner", "tenant", "landlord", "business", "property_manager"):
        c.customer_type = case.customer.type
    fsa = geo.fsa_of(bc.postal_code)
    loc = geo.locate(bc.postal_code)
    if not any(p.postal.replace(" ", "").upper() == bc.postal_code.replace(" ", "").upper() for p in c.properties):
        c.properties.insert(0, PropertyRef(address=bc.address, city=bc.city, postal=bc.postal_code.upper(), fsa=fsa,
                                           lat=loc[0] if loc else None, lon=loc[1] if loc else None,
                                           province="QC" if fsa and fsa[0] in "GHJ" else "ON" if fsa and fsa[0] in "KLMNP" else "unknown"))
    if case.id not in c.case_ids:
        c.case_ids.append(case.id)
    today = clock.today()
    c.consent.profiling_notice_at = clock.now()  # the Law 25 s.8.1 notice is shown on the booking form
    for ch in ("sms", "email"):
        cur: ChannelConsent = getattr(c.consent, ch)
        if marketing_consent:
            setattr(c.consent, ch, ChannelConsent(basis="express", granted_at=today, granted_via="web_form", evidence_ref=f"booking {case.id}",
                                                  text_version=CONSENT_TEXT_VERSION))
        elif cur.basis == "none" or (cur.basis == "implied_inquiry" and (cur.implied_until or today) < today + timedelta(days=183)):
            # booking a visit is an inquiry: 6 months of implied consent (CASL s.10(9)(b)); never downgrade express consent
            setattr(c.consent, ch, ChannelConsent(basis="implied_inquiry", granted_at=today, implied_until=consent.implied_until("implied_inquiry", today),
                                                  granted_via="web_form", evidence_ref=f"booking {case.id}"))
    db.put(c)
    db.put(Interaction(id=db.new_id("i"), contact_id=c.id, case_id=case.id, at=clock.now(), system="google_calendar", kind="booking",
                       summary=f"Booked {b.service}: {b.slot_text}"))
    db.audit("customer", "booked", c.id, f"{case.id} · marketing consent {'yes' if marketing_consent else 'no'}")
    if notes and notes.strip():
        drafts, by = await agents.extract_facts(notes, "booking")
        messaging.save_facts(c, drafts, "booking", f"booking notes {case.id}", by)
    if case.live and case.live.transcript:
        opening = " ".join(t.text.lower() for t in case.live.transcript if t.role == "ai")[:400]
        disclosed = "recorded" in opening or "enregistr" in opening
        said = " ".join(t.text for t in case.live.transcript if t.role == "customer")
        if disclosed and said.strip():  # no disclosure, no learning from the recording
            drafts, by = await agents.extract_facts(said, "bruce")
            messaging.save_facts(c, drafts, "bruce", f"Bruce call {case.live.conversation_id or case.id}", by)
    messaging.recompute_moments(c)
    return c
