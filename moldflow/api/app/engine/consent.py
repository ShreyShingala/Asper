"""CASL / Law 25 gate for every outbound message. Pure functions on (contact, message, history, clock) so they are easy to
test; messaging.send() is the only path out and calls check() first.

Rules implemented
- Commercial electronic messages (CEM: anything encouraging a purchase, incl. a check-in with a booking link) need
  express consent, or implied consent that hasn't expired: 2 years after a purchase, 6 months after an inquiry (CASL s.10(9)).
- A safety-only message (no link, no offer) is not a CEM and may go to people without marketing consent, once per alert.
- Opt-outs (STOP / ARRET / unsubscribe) and the suppression list win over everything; do_not_contact too.
- Quiet hours (default 21:00-09:00 local): the message is held, not dropped.
- Frequency cap: at most 1 marketing message per contact per 7 days.
- Every message gets the sender identity + unsubscribe; AI-sent ones also disclose the automated assistant (Law 25 s.12.1).
"""
import hashlib
from datetime import date, datetime, timedelta

from app import clock
from app.models.crm import ChannelConsent, Contact, Message

COMPANY = "Mold Busters"
ADDRESS = "Ottawa-Gatineau, ON/QC"  # replace with the registered civic address before going live
PHONE = "1-877-566-6653"
SITE = "moldbusters.ca"
IMPLIED_PURCHASE = timedelta(days=730)
IMPLIED_INQUIRY = timedelta(days=183)
MARKETING_GAP = timedelta(days=7)


def ident_hash(identifier: str) -> str:
    norm = "".join(ch for ch in identifier.lower() if ch.isalnum() or ch == "@")
    return hashlib.sha256(norm.encode()).hexdigest()[:24]


def implied_until(basis: str, evidence_date: date) -> date | None:
    return evidence_date + (IMPLIED_PURCHASE if basis == "implied_purchase" else IMPLIED_INQUIRY) if basis.startswith("implied") else None


def consent_ok(c: ChannelConsent, today: date) -> tuple[bool, str]:
    if c.opt_out_at:
        return False, f"opted out on {c.opt_out_at.date().isoformat()}"
    if c.basis == "express":
        return True, "express consent"
    if c.basis.startswith("implied"):
        if c.implied_until and c.implied_until >= today:
            return True, f"implied consent until {c.implied_until.isoformat()}"
        return False, f"implied consent expired {c.implied_until.isoformat() if c.implied_until else '(no date)'}"
    return False, "no consent on record"


def in_quiet_hours(contact: Contact, at: datetime | None = None) -> bool:
    h = (at or clock.local_now()).hour
    s, e = contact.prefs.quiet_start, contact.prefs.quiet_end
    return (h >= s or h < e) if s > e else (s <= h < e)


def check(contact: Contact, msg: Message, history: list[Message], suppressed: bool) -> tuple[str, str]:
    """Returns (decision, reason): decision in {"send", "hold", "block"}."""
    today = clock.today()
    if contact.do_not_contact:
        return "block", "do not contact"
    if suppressed:
        return "block", "on the suppression list (opted out)"
    ch: ChannelConsent = getattr(contact.consent, msg.channel)
    if ch.opt_out_at:
        return "block", f"opted out of {msg.channel}"
    if msg.channel == "sms" and not contact.phones or msg.channel == "email" and not contact.emails:
        return "block", f"no {msg.channel} address"
    if msg.is_cem:
        ok, why = consent_ok(ch, today)
        if not ok:
            return "block", f"CASL: {why}"
        recent = [m for m in history if m.status == "sent_simulated" and m.is_cem and m.direction == "out" and m.id != msg.id
                  and m.sent_at and m.sent_at.date() > today - MARKETING_GAP and not m.trigger.startswith("inbound")]
        if recent and not msg.trigger.startswith("inbound"):
            return "block", f"frequency cap: marketing message already sent on {recent[0].sent_at.date().isoformat()}"
    elif msg.trigger == "storm_safety":
        if any(m.trigger == "storm_safety" and m.trigger_ref == msg.trigger_ref and m.status == "sent_simulated" for m in history):
            return "block", "safety check-in already sent for this alert"
    if msg.trigger.startswith("moment") and any(f.startswith("life:") for f in msg.facts_used) and not contact.consent.personalised_reminders:
        return "block", "references a life event without personalised-reminders consent"
    if in_quiet_hours(contact) and not msg.trigger.startswith("inbound"):
        return "hold", f"quiet hours ({contact.prefs.quiet_start}:00-{contact.prefs.quiet_end}:00), will send at {contact.prefs.quiet_end}:00"
    return "send", "ok"


def footer(msg: Message, ai_sent: bool) -> str:
    fr = msg.language == "fr"
    if msg.channel == "sms":
        parts = [f"- {COMPANY}, {SITE}, {PHONE}."]
        if msg.is_cem:
            parts.append("Répondez ARRÊT pour vous désabonner." if fr else "Reply STOP to opt out.")
        if ai_sent:
            parts.append("Assistant automatisé: répondez HUMAIN pour une personne." if fr else "Automated assistant: reply HUMAN for a person.")
        return " ".join(parts)
    lines = [f"{COMPANY} · {ADDRESS} · {PHONE} · {SITE}"]
    if msg.is_cem:
        lines.append("Se désabonner : répondez ARRÊT ou visitez " + SITE + "/me" if fr else "Unsubscribe: reply STOP or visit " + SITE + "/me")
    if ai_sent:
        lines.append("Envoyé par l'assistant automatisé de Mold Busters. Répondez HUMAIN pour parler à une personne." if fr
                     else "Sent by Mold Busters' automated assistant. Reply HUMAN to reach a person.")
    return "\n\n" + "\n".join(lines)


STOP_WORDS = {"stop", "arret", "arrêt", "unsubscribe", "desabonner", "désabonner", "cancel", "end", "quit"}
HUMAN_WORDS = {"human", "humain", "person", "personne", "agent", "representative"}


def keyword(body: str) -> str | None:
    w = body.strip().lower().strip(".!? ")
    if w in STOP_WORDS:
        return "stop"
    if w in HUMAN_WORDS:
        return "human"
    return None
