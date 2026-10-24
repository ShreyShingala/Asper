"""The Evidence Passport: one case record that every MoldFlow stage reads and writes."""
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal

from annotated_types import Len
from pydantic import BaseModel, Field, model_validator

from app.models.agents import PhotoAnalysis, ReportDraft

SCHEMA_VERSION = 1

Stage = Literal["intake", "pre_assessed", "inspection_booked", "inspected", "report_draft",
                "report_approved", "quoted", "accepted", "declined", "stalled"]
Service = Literal["self_help", "virtual", "onsite", "iaq", "remediation", "remote_report", "referral"]
ReadingKind = Literal["temp_rh_dew", "moisture", "thermal", "swab", "air_sample", "ball_slope", "visual"]
ReadingResult = Literal["elevated", "normal", "positive", "negative", "failed", "passed", "anomaly", "none", "not_recorded"]

ALLOWED_RESULTS: dict[str, set[str]] = {
    "temp_rh_dew": {"elevated", "normal", "not_recorded"},
    "moisture": {"elevated", "normal", "not_recorded"},
    "thermal": {"anomaly", "none", "not_recorded"},
    "swab": {"positive", "negative", "not_recorded"},
    "air_sample": {"positive", "negative", "not_recorded"},
    "ball_slope": {"failed", "passed", "not_recorded"},
    "visual": {"anomaly", "none"},
}
CENT = Decimal("0.01")


def now() -> datetime:
    from app import clock
    return clock.now()


class Customer(BaseModel):
    type: Literal["homeowner", "tenant", "landlord", "business", "property_manager", "unknown"] = "unknown"
    alias: str = "New customer"
    contact_simulated: str | None = None


class Property(BaseModel):
    country: str = "CA"
    postal_prefix: str | None = None
    province: Literal["ON", "QC", "other", "unknown"] = "unknown"
    in_service_area: bool | None = None
    type: Literal["house", "apartment", "condo", "other", "unknown"] = "unknown"
    region_text: str | None = None


class Photo(BaseModel):
    id: str
    path: str
    room: str | None = None
    source: Literal["customer", "inspector"]
    prompt_id: str | None = None
    caption_from_pack: str | None = None
    analysis: PhotoAnalysis | None = None
    analysis_tier: str | None = None
    analysis_latency_ms: int | None = None
    analysis_model: str | None = None
    uploaded_at: datetime = Field(default_factory=now)


class Reading(BaseModel):
    kind: ReadingKind
    result: ReadingResult
    value_text: str | None = None
    location: str
    photo_ids: list[str] = []

    @model_validator(mode="after")
    def _result_fits_kind(self):
        if self.result not in ALLOWED_RESULTS[self.kind]:
            raise ValueError(f"result '{self.result}' not allowed for kind '{self.kind}'")
        return self


class Finding(BaseModel):
    id: str
    room: str
    observation: str
    readings: list[Reading] = []
    evidence_photo_ids: Annotated[list[str], Len(min_length=1)]
    source: Literal["inspector_entered", "ai_structured"]
    confirmed: bool = False


class LineItem(BaseModel):
    code: str
    description: str
    qty: Decimal = Decimal("1")
    unit_price: Decimal
    illustrative: bool = True


class Estimate(BaseModel):
    id: str
    service: Service
    areas: list[str]
    scope_text: list[str] = []
    line_items: list[LineItem] = []
    subtotal: Decimal
    province: Literal["ON", "QC", "other", "unknown"]
    tax_label: str
    tax_rate: Decimal
    tax: Decimal
    total: Decimal
    deposit_pct: int | None = None
    deposit: Decimal | None = None
    valid_days: int | None = None
    issued_on: date
    expires_on: date | None = None
    duration_text: str | None = None
    terms: list[str] = []
    status: Literal["draft", "approved", "sent", "viewed", "accepted", "declined", "expired"] = "draft"
    source: Literal["sample_pack", "engine"]
    real_world_status: str | None = None  # what the sample pack recorded

    @model_validator(mode="after")
    def _math_consistent(self):
        tax = (self.subtotal * self.tax_rate).quantize(CENT)
        if tax != self.tax or (self.subtotal + tax).quantize(CENT) != self.total:
            raise ValueError("estimate totals do not reconcile")
        return self


class Flag(BaseModel):
    id: str
    check: Literal["completeness", "scope", "estimate", "record_conflict", "guardrail", "offer"]
    severity: Literal["info", "warn", "block"]
    message: str
    refs: list[str] = []
    source: str | None = None
    resolved: bool = False
    resolution_note: str | None = None
    resolved_by: str | None = None


class Event(BaseModel):
    at: datetime | None = None
    at_text: str
    step: str
    system: str
    what: str
    source: Literal["sample_pack", "moldflow", "simulated"]


class FollowUp(BaseModel):
    id: str
    channel: Literal["sms", "email"]
    body: str
    reason: str
    cites: list[str] = []
    offer_token_used: bool = False
    status: Literal["draft", "approved", "sent_simulated"] = "draft"
    as_of: date | None = None
    tier: str | None = None
    created_at: datetime = Field(default_factory=now)


class Approval(BaseModel):
    what: Literal["report", "estimate", "followup"]
    drafted_by: str = "MoldFlow"
    reviewed_by: str
    at: datetime = Field(default_factory=now)


class AIUsage(BaseModel):
    agent: str
    model: str
    latency_ms: int
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_usd: float | None = None
    tier: Literal["live", "fallback", "exact_cache", "fixture", "rule"]
    at: datetime = Field(default_factory=now)


class PreAssessment(BaseModel):
    summary: str
    observed: list[str]
    cannot_tell: list[str]
    recommended_service: Service
    service_price_text: str
    reasons: list[str]
    annotated_photo_ids: list[str]
    next_actions: list[Literal["book", "landlord_letter", "remote_report", "call_me"]]
    health_note: str | None = None
    tier: str | None = None
    generated_at: datetime = Field(default_factory=now)


class Letter(BaseModel):
    kind: Literal["landlord"] = "landlord"
    body: str
    language: Literal["en", "fr"]
    based_on_ids: list[str]
    generated_at: datetime = Field(default_factory=now)


class BookingContact(BaseModel):
    name: Annotated[str, Len(min_length=2, max_length=120)]
    phone: Annotated[str, Len(min_length=7, max_length=30)]
    email: Annotated[str, Len(max_length=200)] = ""
    address: Annotated[str, Len(min_length=3, max_length=200)]
    city: Annotated[str, Len(min_length=2, max_length=80)]
    postal_code: Annotated[str, Len(min_length=3, max_length=10)]


class Booking(BaseModel):
    service: Service
    slot_text: str
    status: Literal["requested_simulated", "confirmed_simulated", "paid_simulated"] = "requested_simulated"
    at: datetime = Field(default_factory=now)
    customer_type: str | None = None
    slot_date: date | None = None
    slot_time: str | None = None
    timezone: str | None = None
    contact: BookingContact | None = None
    tip: int | None = Field(default=None, description="Optional tip-jar amount in CAD (10, 15 or 25)")
    notes: str | None = None


class StoredReport(BaseModel):
    draft: ReportDraft
    dropped_claims: list[str] = []
    tier: str | None = None
    generated_at: datetime = Field(default_factory=now)


class TranscriptLine(BaseModel):
    role: Literal["customer", "ai"]
    text: str
    at_ms: int | None = Field(default=None, description="Milliseconds since the call started")


class LiveSession(BaseModel):
    """A live camera + voice pre-assessment call (ElevenLabs agent). The full transcript is kept as evidence for staff."""
    conversation_id: str | None = None
    started_at: datetime = Field(default_factory=now)
    ended_at: datetime | None = None
    transcript: list[TranscriptLine] = []
    summary: str | None = None
    key_points: list[str] = []
    summary_tier: str | None = None


class Case(BaseModel):
    schema_version: int = SCHEMA_VERSION
    id: str
    title: str
    created_at: datetime = Field(default_factory=now)
    stage: Stage = "intake"
    language: Literal["en", "fr"] = "en"
    intake_mode: Literal["upload", "live"] = "upload"
    contact_id: str | None = None
    live: LiveSession | None = None
    seeded_from: str | None = None
    customer: Customer = Customer()
    property: Property = Property()
    concern: str = ""
    answers: dict[str, str] = {}
    unknowns: list[str] = []
    health_flag: bool = False
    photos: list[Photo] = []
    findings: list[Finding] = []
    recommendations: list[str] = []
    recommended_service: Service | None = None
    routing_reasons: list[str] = []
    pre_assessment: PreAssessment | None = None
    letters: list[Letter] = []
    booking: Booking | None = None
    report: StoredReport | None = None
    estimate: Estimate | None = None
    flags: list[Flag] = []
    followups: list[FollowUp] = []
    approvals: list[Approval] = []
    timeline: list[Event] = []
    ai_usage: list[AIUsage] = []

    def photo(self, photo_id: str) -> Photo | None:
        return next((p for p in self.photos if p.id == photo_id), None)

    def open_blocks(self) -> list[Flag]:
        return [f for f in self.flags if f.severity == "block" and not f.resolved]
