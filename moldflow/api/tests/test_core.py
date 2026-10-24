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


def test_findings_grounding_words():
    from app.agents.tasks import _words
    note = _words("Tub faucet leaking, moisture meter shows elevated moisture below the faucet.")
    assert _words("Tub faucet leaking.") & note
    assert not (_words("Ball slope test failed shower.") & note)
    assert not (_words("Discoloration visible.") & note)


def test_live_answer_validation():
    from app.engine import live
    assert live.validate_answer("odor", "yes") == "Yes"
    assert live.validate_answer("occupant", "landlord") == "Landlord / manager"
    assert live.validate_answer("room", "Salle de bain") == "Bathroom"
    assert live.validate_answer("location", " K1A 0B1 ") == "K1A 0B1"
    with pytest.raises(ValueError):
        live.validate_answer("odor", "purple")
    with pytest.raises(ValueError):
        live.validate_answer("favourite_colour", "blue")


def test_live_checklist_follows_intake_rules():
    from app.engine import live
    from app.models.passport import Photo
    c = Case(id="t", title="t", intake_mode="live")
    cl = live.checklist(c)
    assert not cl["ready_to_finish"] and not cl["can_finish_early"]
    assert {s["shot"] for s in cl["missing_shots"]} == {"wide", "close", "above", "nearby"}
    c.answers = {"leak": "No", "room": "Bedroom"}
    assert {s["shot"] for s in live.checklist(c)["missing_shots"]} == {"wide", "close"}
    c.photos = [Photo(id="p1", path="x", source="customer", prompt_id="wide",
                      analysis=PhotoAnalysis(observations=["wall"]))]
    cl = live.checklist(c)
    assert cl["can_finish_early"] and cl["photos_left"] == 5 and cl["shots_taken"] == ["wide"]


def test_booking_schedule_matches_published_slots():
    from app.engine import booking
    days = booking.availability(date(2026, 10, 24), set())
    first4 = [(d["relative"], d["weekday"], d["label"], d["slots"]) for d in days[:4]]
    assert first4 == [
        ("next week", "Friday", "Oct 30", ["10:00 AM", "11:15 AM", "12:30 PM", "3:00 PM", "4:15 PM"]),
        ("in 2 weeks", "Monday", "Nov 2", ["10:00 AM", "11:15 AM", "12:30 PM", "3:00 PM", "4:15 PM"]),
        ("in 2 weeks", "Tuesday", "Nov 3", ["10:00 AM", "11:15 AM", "12:30 PM", "1:45 PM", "3:00 PM"]),
        ("in 2 weeks", "Wednesday", "Nov 4", ["10:00 AM", "12:30 PM", "1:45 PM", "3:00 PM", "4:15 PM"]),
    ]
    assert all(date.fromisoformat(d["date"]).weekday() < 5 for d in days)


def test_booking_rules():
    from app.engine import booking
    today, d = date(2026, 10, 24), date(2026, 10, 30)
    assert booking.is_available(d, "10:00 AM", today, set())
    assert not booking.is_available(d, "10:00 AM", today, {(d, "10:00 AM")})
    assert not booking.is_available(d, "1:45 PM", today, set())          # held in the seeded calendar
    assert not booking.is_available(date(2026, 10, 31), "10:00 AM", today, set())  # Saturday
    assert "tenant" not in booking.BOOKABLE_TYPES and set(booking.TIPS) == {10, 15, 25}
    assert booking.TIPS[25] == "Tip Jar - Support Us ($25)"
