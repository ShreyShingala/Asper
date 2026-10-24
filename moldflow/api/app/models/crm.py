"""Relationship hub entities: one Contact per person, with what we've learned about them (ProfileFact), everything that
happened across the company's tools (Interaction), every SMS/email (Message), upcoming reasons to reach out (Moment),
weather alerts (AlertEvent), human work (Task) and an audit trail. Legal rules (CASL consent, Law 25) live in the types
where possible so they can't be skipped by a code path.
Why: docs/04_decisions.md D9-D16; docs/03_product.md (Part B)."""
from datetime import date, datetime
from typing import ClassVar, Literal

from pydantic import BaseModel, Field, model_validator

from app.models.passport import now

Channel = Literal["sms", "email"]
System = Literal["google_calendar", "freshbooks", "asana", "close", "brain", "dialpad", "email", "sms", "moldflow", "bruce"]
FactCategory = Literal["home", "household", "life_event", "preference", "health", "work", "other"]
ConsentBasis = Literal["express", "implied_purchase", "implied_inquiry", "none"]
MomentKind = Literal["estimate_expiry", "post_remediation_check", "storm_season", "back_to_school", "nursery_humidity",
                     "spring_melt", "fact_follow_up"]


class ChannelConsent(BaseModel):
    """CASL: who said yes, how, when, and until when (implied consent expires). Never fabricated on import."""
    basis: ConsentBasis = "none"
    granted_at: date | None = None
    implied_until: date | None = None
    granted_via: Literal["web_form", "call", "reply", "import", "staff"] | None = None
    evidence_ref: str | None = None
    text_version: str | None = None
    opt_out_at: datetime | None = None


class Consent(BaseModel):
    sms: ChannelConsent = ChannelConsent()
    email: ChannelConsent = ChannelConsent()
    personalised_reminders: bool = False          # express opt-in to messages that reference life events
    profiling_notice_at: datetime | None = None   # Quebec Law 25 s.8.1 notice shown


class Prefs(BaseModel):
    channel: Channel = "sms"
    quiet_start: int = 21
    quiet_end: int = 9
    storm_checkin_opt_in: bool = False            # a preference, never consent


class PropertyRef(BaseModel):
    address: str = ""
    city: str = ""
    postal: str = ""
    fsa: str | None = None
    lat: float | None = None
    lon: float | None = None
    province: Literal["ON", "QC", "other", "unknown"] = "unknown"


class Contact(BaseModel):
    id: str
    name: str
    phones: list[str] = []
    emails: list[str] = []
    language: Literal["en", "fr"] = "en"
    customer_type: Literal["homeowner", "tenant", "landlord", "business", "property_manager", "unknown"] = "unknown"
    properties: list[PropertyRef] = []
    case_ids: list[str] = []
    tags: list[str] = []
    consent: Consent = Consent()
    prefs: Prefs = Prefs()
    do_not_contact: bool = False
    owner: str = "ai"                              # conversation ownership: "ai" or "human:<name>"
    synthetic: bool = False                        # demo data, labelled on every screen
    created_at: datetime = Field(default_factory=now)
    merged_into: str | None = None


class FactSource(BaseModel):
    kind: Literal["call", "sms", "email", "note", "form", "booking", "bruce", "import"]
    ref: str | None = None
    quote: str
    recording_disclosed: bool = True


class FactEdit(BaseModel):
    by: str
    at: datetime = Field(default_factory=now)
    before: str
    after: str


class ProfileFact(BaseModel):
    id: str
    contact_id: str
    text: str
    category: FactCategory
    source: FactSource
    learned_at: datetime = Field(default_factory=now)
    confidence: float = 0.8
    status: Literal["pending", "approved", "rejected"] = "pending"
    message_use: Literal["never", "light"] = "never"
    follow_up: date | None = None
    follow_up_reason: str | None = None
    expires_at: date | None = None
    edits: list[FactEdit] = []
    extracted_by: Literal["ai", "rule", "staff", "customer"] = "ai"

    @model_validator(mode="after")
    def _health_never_in_messages(self):
        # PIPEDA / Law 25: health is sensitive; it may inform the case but never a marketing message.
        if self.category == "health":
            self.message_use = "never"
        return self


class Interaction(BaseModel):
    id: str
    contact_id: str
    case_id: str | None = None
    at: datetime
    system: System
    kind: str                                      # call, sms_in, sms_out, email, invoice, estimate, calendar, card, note...
    summary: str
    amount: float | None = None
    by: str | None = None
    meta: dict[str, str] = {}                      # e.g. estimate status (sent/viewed/accepted), chased=yes
    synthetic: bool = False


class Message(BaseModel):
    id: str
    contact_id: str
    case_id: str | None = None
    channel: Channel
    direction: Literal["out", "in"] = "out"
    subject: str | None = None
    body: str
    final_body: str | None = None                  # body + compliance footer, exactly as sent
    language: Literal["en", "fr"] = "en"
    trigger: str                                   # inbound_reply, estimate_chase, storm_safety, storm_offer, moment:<kind>, manual...
    trigger_ref: str | None = None
    is_cem: bool = True                            # CASL commercial electronic message?
    facts_used: list[str] = []
    reason: str = ""
    status: Literal["draft", "approved", "sent_simulated", "blocked", "received"] = "draft"
    blocked_reason: str | None = None
    autonomy: Literal["auto", "draft", "locked"] = "draft"
    amount: float | None = None                    # money-bearing messages show the amount on the approve button
    drafted_by: Literal["ai", "rule", "staff"] = "ai"
    tier: str | None = None
    approved_by: str | None = None
    created_at: datetime = Field(default_factory=now)
    sent_at: datetime | None = None
    in_reply_to: str | None = None


class Moment(BaseModel):
    id: str
    contact_id: str
    kind: MomentKind
    due: date
    reason: str
    source_fact_id: str | None = None
    case_id: str | None = None
    status: Literal["upcoming", "drafted", "done", "skipped"] = "upcoming"
    human_only: bool = False                       # talking point for a person, never an automated message


class AlertMatch(BaseModel):
    contact_id: str
    priority: int                                  # 1 = asked for storm check-ins, 2 = past water/basement case, 3 = in area
    reason: str


class AlertEvent(BaseModel):
    id: str
    source: Literal["env_canada", "simulated"]
    type: str
    area: str
    geometry: dict
    starts: datetime | None = None
    ends: datetime | None = None
    text_en: str = ""
    text_fr: str = ""
    matches: list[AlertMatch] = []
    status: Literal["active", "ended"] = "active"
    fetched_at: datetime = Field(default_factory=now)


class Task(BaseModel):
    id: str
    kind: Literal["call_back", "escalation", "approve", "crew_schedule", "lab_followup", "clearance_letter", "verify_fact", "other"]
    title: str
    contact_id: str | None = None
    case_id: str | None = None
    owner: str | None = None
    due: date | None = None
    status: Literal["open", "done"] = "open"
    created_at: datetime = Field(default_factory=now)


class AuditEntry(BaseModel):
    id: str
    at: datetime = Field(default_factory=now)
    actor: str                                     # "ai", "rule", "system" or a staff name
    action: str
    target: str
    detail: str = ""


class AutonomySettings(BaseModel):
    """What the AI may do on its own. 'locked' categories can never be switched to auto."""
    paused: bool = False                           # kill switch: nothing leaves the building
    levels: dict[str, Literal["auto", "draft", "off"]] = {
        "booking_confirmation": "auto", "reminder": "auto", "faq_reply": "auto", "receipt": "auto",
        "inbound_reply": "auto", "booking_offer": "auto", "report_ready": "auto",
        "estimate_chase": "draft", "storm_safety": "draft", "storm_offer": "draft", "moment": "draft", "manual": "draft",
        "muse_draft": "draft", "escalation_reply": "draft",
    }
    LOCKED: ClassVar[tuple[str, ...]] = ("money", "personal_fact", "health")
