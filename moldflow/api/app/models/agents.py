"""Pydantic v2 output models for every AI agent call. The LLM must return JSON matching these."""
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class Region(BaseModel):
    label: str = Field(description="Short phrase, e.g. 'look closer: ceiling staining'")
    box_2d: tuple[int, int, int, int] = Field(description="[ymin, xmin, ymax, xmax] normalized 0-1000")

    @field_validator("box_2d", mode="before")
    @classmethod
    def _normalize(cls, v: Any):
        if isinstance(v, dict):
            v = [v.get(k) for k in ("ymin", "xmin", "ymax", "xmax")]
        vals = [float(x) for x in v]
        if len(vals) != 4:
            raise ValueError("box needs 4 numbers")
        if max(vals) <= 1.0:
            vals = [x * 1000 for x in vals]
        if max(vals) > 1000 or min(vals) < 0:
            raise ValueError("box outside 0-1000 (pixel coordinates are not usable)")
        y0, x0, y1, x1 = vals
        y0, y1 = sorted((y0, y1))
        x0, x1 = sorted((x0, x1))
        if (y1 - y0) < 15 or (x1 - x0) < 15:
            raise ValueError("degenerate box")
        return tuple(int(round(x)) for x in (y0, x0, y1, x1))


class PhotoAnalysis(BaseModel):
    image_type: Literal["regular", "thermal", "test_kit", "instrument", "other"] = "regular"
    observations: list[str] = Field(description="Plain-language visible observations, 1-4 items")
    regions: list[Region] = Field(default=[], description="Areas worth a closer look (may be empty)")
    visible_moisture: bool | None = None
    scale_reference_visible: bool = False
    quality: Literal["ok", "too_dark", "blurry", "not_relevant"] = "ok"
    follow_up_question: str | None = Field(default=None, description="One question a mold inspector would ask next")
    declined_to_confirm_mold: bool = Field(default=True, description="True if you did NOT claim mold is confirmed")

    @field_validator("regions", mode="before")
    @classmethod
    def _drop_bad_regions(cls, v: Any):
        good = []
        for r in v or []:
            try:
                good.append(Region.model_validate(r))
            except Exception:
                continue
        return good[:4]

    @field_validator("image_type", mode="before")
    @classmethod
    def _coerce_type(cls, v: Any):
        return v if v in ("regular", "thermal", "test_kit", "instrument", "other") else "other"


class ChipQuestion(BaseModel):
    key: str
    text: str
    options: list[str]


class PhotoPrompt(BaseModel):
    prompt_id: str
    text: str
    why: str


class IntakeTurn(BaseModel):
    extracted: dict[str, str] = {}
    next_chip_question: ChipQuestion | None = None
    photo_prompt: PhotoPrompt | None = None
    ready: bool = False


class AssessDraft(BaseModel):
    summary: str = Field(description="2-3 sentence plain-language summary for the customer; no diagnosis")
    observed: list[str] = Field(description="What is visibly observable in the photos")
    cannot_tell: list[str] = Field(description="What photos cannot tell us (hidden moisture, species, extent behind surfaces...)")
    suggested_service: Literal["virtual", "onsite", "iaq"]
    reasons: list[str] = Field(description="1-3 short reasons for the suggested service")
    unknowns: list[str] = []
    escalate: bool = False


class Routing(BaseModel):
    service: Literal["self_help", "virtual", "onsite", "iaq", "remediation", "remote_report", "referral"]
    reasons: list[str]
    unknowns: list[str] = []
    escalate: bool = False


class FindingDraft(BaseModel):
    room: str
    observation: str
    reading_kind: Literal["temp_rh_dew", "moisture", "thermal", "swab", "air_sample", "ball_slope", "visual"] | None = None
    reading_result: Literal["elevated", "normal", "positive", "negative", "failed", "passed", "anomaly", "none", "not_recorded"] | None = None
    evidence_photo_ids: list[str] = []


class FindingsOut(BaseModel):
    findings: list[FindingDraft]


class Claim(BaseModel):
    text: str
    cites: list[str] = Field(description="Finding ids or photo ids supporting this sentence")


class ReportSection(BaseModel):
    room: str
    claims: list[Claim]


class ReportDraft(BaseModel):
    summary: str
    sections: list[ReportSection]
    recommendations: list[Claim]
    limitations: list[str]


class FollowUpDraft(BaseModel):
    channel: Literal["sms", "email"] = "sms"
    body: str = Field(max_length=360, description="The message to the customer, <= 320 characters for SMS")
    reason: str = Field(description="Why this message, for staff")
    cites: list[str] = Field(default=[], description="Finding/photo ids referenced")
    uses_offer_token: bool = False
