from datetime import date
from decimal import Decimal

import pytest

from app.agents.llm import _extract_json
from app.engine import checks, rules
from app.engine.pricing import build_estimate, service_price_text
from app.models.agents import AssessDraft, PhotoAnalysis, Region
from app.models.passport import Case, Estimate, Finding, Reading
from app.seed import seeds


def test_job_estimates_reconcile():
    j1, j2 = seeds.job1(), seeds.job2()
    assert (j1.estimate.total, j1.estimate.deposit, j1.estimate.expires_on) == (Decimal("4181.00"), Decimal("1672.40"), date(2026, 12, 6))
    assert j2.estimate.total == Decimal("597.87") and j2.estimate.deposit is None


def test_illustrative_split_sums_to_subtotal():
    e = seeds.job1().estimate
    assert sum(li.unit_price for li in e.line_items) == e.subtotal and all(li.illustrative for li in e.line_items)


def test_estimate_rejects_bad_math():
    e = seeds.job1().estimate.model_dump()
    e["total"] = Decimal("4000")
    with pytest.raises(ValueError):
        Estimate.model_validate(e)


def test_unknown_province_cannot_be_taxed():
    with pytest.raises(ValueError):
        build_estimate(est_id="x", service="iaq", areas=[], subtotal=Decimal(1), province="unknown", issued_on=date.today(), source="engine")


def test_job1_scope_block_and_concern_warn():
    flags = seeds.job1().flags
    assert any(f.check == "scope" and f.severity == "block" and "Basement" in f.message for f in flags)
    assert any(f.check == "scope" and "original concern" in f.message for f in flags)
    assert sum(f.check == "record_conflict" for f in flags) == 2


def test_resolution_survives_rerun():
    c = seeds.job1()
    blk = next(f for f in c.flags if f.severity == "block")
    blk.resolved, blk.resolution_note = True, "intentional"
    c.flags = checks.run_all(c)
    assert next(f for f in c.flags if f.id == blk.id).resolved


def test_estimate_province_mismatch_blocks():
    c = seeds.job2()
    c.property.province = "ON"
    assert any(f.severity == "block" and "taxed for QC" in f.message for f in checks.estimate(c))


@pytest.mark.parametrize("box,expected", [
    ([100, 200, 300, 400], (100, 200, 300, 400)),
    ([0.1, 0.2, 0.3, 0.4], (100, 200, 300, 400)),
    ([300, 400, 100, 200], (100, 200, 300, 400)),
    ({"ymin": 1, "xmin": 2, "ymax": 300, "xmax": 400}, (1, 2, 300, 400)),
])
def test_region_normalization(box, expected):
    assert Region(label="x", box_2d=box).box_2d == expected


def test_bad_regions_dropped_not_fatal():
    a = PhotoAnalysis.model_validate({"observations": ["x"], "regions": [{"label": "px", "box_2d": [10, 2000, 50, 2400]}, {"label": "short", "box_2d": [1, 2]}]})
    assert a.regions == []


def test_reading_result_must_fit_kind():
    with pytest.raises(ValueError):
        Reading(kind="swab", result="elevated", location="x")


def test_finding_requires_evidence():
    with pytest.raises(ValueError):
        Finding(id="x", room="r", observation="o", evidence_photo_ids=[], source="inspector_entered")


def test_offer_check():
    assert checks.offer_check("Book now and get 10% off!", False)
    assert checks.offer_check("Your estimate EST-1 expires Dec 6.", False) == []
    assert checks.offer_check("10% off as approved", True) == []


def _draft(service="virtual"):
    return AssessDraft(summary="s", observed=["o"], cannot_tell=["c"], suggested_service=service, reasons=["r"])


def test_routing_rules():
    c = Case(id="t", title="t")
    rules.apply_location(c, "Australia")
    assert rules.route(c, _draft()).service == "remote_report"
    rules.apply_location(c, "K1A 0B1")
    assert c.property.province == "ON" and c.property.in_service_area
    c.health_flag, c.answers = True, {"odor": "Yes"}
    assert rules.route(c, _draft()).service == "iaq"
    c.health_flag, c.answers = False, {"leak": "Yes"}
    assert rules.route(c, _draft("virtual")).service == "onsite"


def test_health_text_is_fixed_and_bilingual():
    assert "medical advice" in rules.HEALTH_TEXT["en"] and "avis médical" in rules.HEALTH_TEXT["fr"]


def test_documented_prices_only():
    assert service_price_text("onsite", "ON") == "On-site visual & diagnostic inspection: $195.00 + HST 13%"
    assert "incl. tax" in service_price_text("virtual", "QC")
    assert service_price_text("remediation", "ON") == ""


def test_intake_is_photo_first_then_chips():
    c = Case(id="t", title="t")
    assert rules.next_turn(c).photo_prompt.prompt_id == "wide"


def test_extract_json_handles_fences_and_think():
    assert _extract_json('<think>hmm</think>```json\n{"a": 1}\n```') == '{"a": 1}'
