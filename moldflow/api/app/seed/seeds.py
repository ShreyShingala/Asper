"""Seed both sample cases. Sources: job_timeline.json (incl. findings/recommendations/estimate), photo filenames,
Job_Story.pdf. The reference reports are NEVER used as seed or model input, except the one address-line
record conflict, which is cited as such."""
import json
import re
from datetime import date, datetime
from decimal import Decimal

from app import config
from app.engine import checks
from app.engine.pricing import build_estimate
from app.models.passport import Case, Customer, Event, Finding, Flag, Photo, Property, Reading

J1, J2 = "job1", "job2"
R_BASE, R_WASH, R_ATTIC, R_THERM, R_EXT = "Basement", "Upstairs washrooms", "Attic", "Top floor, living room & laundry ceiling", "Exterior"

# filename -> (room, reading kind, reading result). Derived from the organizer's photo filenames.
JOB1_PHOTOS: dict[str, tuple[str, str | None, str | None]] = {
    "01_No_thermal_anomalies_basement_1.jpg": (R_BASE, "thermal", "none"),
    "02_No_thermal_anomalies_basement_2.jpg": (R_BASE, "thermal", "none"),
    "03_Humidity_within_normal_range.jpg": (R_BASE, "temp_rh_dew", "normal"),
    "04_Swab_test_1.jpg": (R_BASE, None, None), "05_Swab_test_2.jpg": (R_BASE, None, None), "06_Swab_test_3.jpg": (R_BASE, None, None),
    "07_Swab_test_positive_for_mold.jpg": (R_BASE, "swab", "positive"),
    "08_Thermal_anomaly_1.jpg": (R_THERM, "thermal", "anomaly"), "09_Thermal_anomaly_2.jpg": (R_THERM, "thermal", "anomaly"),
    "10_Thermal_anomaly_3.jpg": (R_THERM, "thermal", "anomaly"), "11_Thermal_anomaly_4.jpg": (R_THERM, "thermal", "anomaly"),
    "12_Ball_slope_test_failed_shower.jpg": (R_WASH, "ball_slope", "failed"),
    "13_Washroom_discoloration_1.jpg": (R_WASH, "visual", "anomaly"), "14_Washroom_discoloration_2.jpg": (R_WASH, "visual", "anomaly"),
    "15_Washroom_discoloration_3.jpg": (R_WASH, "visual", "anomaly"),
    "16_Elevated_moisture_at_tub_faucet.jpg": (R_WASH, "moisture", "elevated"),
    "17_Attic_disturbed_insulation_1.jpg": (R_ATTIC, "visual", "anomaly"), "18_Attic_disturbed_insulation_2.jpg": (R_ATTIC, "visual", "anomaly"),
    "19_Attic_disturbed_insulation_3.jpg": (R_ATTIC, "visual", "anomaly"), "20_Attic_disturbed_insulation_4.jpg": (R_ATTIC, "visual", "anomaly"),
    "21_Exterior_drainage_and_depression.jpg": (R_EXT, "visual", "anomaly"),
}
JOB2_PHOTOS = {"01_Discoloration_dryer_vent_hose.jpg": "Laundry (dryer vent hose)",
               "02_Discoloration_ceiling_vent.jpg": "Ceiling vent", "03_Discoloration_vent_grille.jpg": "Wall vent grille"}


def pid(fname: str) -> str:
    return "p" + fname.split("_")[0]


def caption(fname: str) -> str:
    return re.sub(r"^\d+_", "", fname.rsplit(".", 1)[0]).replace("_", " ")


def _timeline(d: dict, year: int) -> list[Event]:
    out = []
    for e in d["timeline"]:
        at = None
        m = re.search(r"([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?(?: (\d{1,2}):(\d{2}))?", e["when_eastern"])
        if m:
            try:
                at = datetime.strptime(f"{m[1]} {m[2]} {m[3] or year} {m[4] or 0}:{m[5] or 0}", "%b %d %Y %H:%M")
            except ValueError:
                at = None
        out.append(Event(at=at, at_text=e["when_eastern"], step=e["step"], system=e["system"], what=e["what"], source="sample_pack"))
    return out


def _load(folder: str) -> dict:
    return json.loads((config.PACK_DIR / folder / "job_timeline.json").read_text())


def _reading(fname: str) -> Reading | None:
    room, kind, result = JOB1_PHOTOS[fname]
    return Reading(kind=kind, result=result, location=room, photo_ids=[pid(fname)], value_text=caption(fname)) if kind else None


def job1(include_faucet: bool = False) -> Case:
    d = _load("01_OnSite_Sample")
    photos = [Photo(id=pid(f), path=f"01_OnSite_Sample/Photos/{f}", room=room, source="inspector", caption_from_pack=caption(f))
              for f, (room, _, _) in JOB1_PHOTOS.items()]

    def rd(*files):
        return [r for f in files if (r := _reading(f))]

    findings = [
        Finding(id="F1", room=R_BASE, source="inspector_entered", confirmed=True,
                observation="Small discoloration under the sink; swab test positive. No odour, no thermal anomalies, humidity and moisture normal.",
                readings=rd("07_Swab_test_positive_for_mold.jpg", "01_No_thermal_anomalies_basement_1.jpg", "03_Humidity_within_normal_range.jpg"),
                evidence_photo_ids=["p07", "p04", "p01", "p03"]),
        Finding(id="F2", room=R_THERM, source="inspector_entered", confirmed=True,
                observation="Thermal anomalies on the top floor, in the living room below the roof and on the laundry room ceiling (rest of house checked at no charge).",
                readings=rd("08_Thermal_anomaly_1.jpg", "09_Thermal_anomaly_2.jpg"), evidence_photo_ids=["p08", "p09", "p10", "p11"]),
        Finding(id="F3", room=R_WASH, source="inspector_entered", confirmed=True,
                observation="Both upstairs washrooms: discoloration on grout and silicone; standing water in the en-suite; failed ball-slope test in the shower.",
                readings=rd("12_Ball_slope_test_failed_shower.jpg", "13_Washroom_discoloration_1.jpg"), evidence_photo_ids=["p12", "p13", "p14", "p15"]),
        Finding(id="F4", room=R_ATTIC, source="inspector_entered", confirmed=True,
                observation="Insulation uneven and heavily disturbed; visible discoloration.",
                readings=rd("17_Attic_disturbed_insulation_1.jpg"), evidence_photo_ids=["p17", "p18", "p19", "p20"]),
        Finding(id="F5", room=R_EXT, source="inspector_entered", confirmed=True,
                observation="Poor drainage and a low spot (depression) by the main entrance.",
                readings=rd("21_Exterior_drainage_and_depression.jpg"), evidence_photo_ids=["p21"]),
    ]
    if include_faucet:
        findings.append(Finding(id="F6", room=R_WASH, source="inspector_entered", confirmed=True,
                                observation="Leaking tub faucet with high moisture below.", readings=rd("16_Elevated_moisture_at_tub_faucet.jpg"),
                                evidence_photo_ids=["p16"]))
    est = build_estimate(est_id="EST-CASE01", service="remediation", areas=[R_WASH, R_ATTIC], subtotal=Decimal("3700"),
                         province="ON", issued_on=date(2026, 10, 7), source="sample_pack", scope_text=d["estimate"]["scope"],
                         duration_text=d["estimate"]["time"], status="draft", split=True)
    est.real_world_status = "Viewed by client, not accepted yet (lead still 'Potential')"
    case = Case(
        id=J1, title="Sample Job 1: on-site inspection (Ontario house)", stage="inspected", seeded_from="01_OnSite_Sample",
        customer=Customer(type="homeowner", alias="Homeowner (Sample Client 01)"),
        property=Property(province="ON", in_service_area=True, type="house", region_text=d["property"]),
        concern=d["client_concern"], photos=photos, findings=findings, recommendations=d["recommendations"],
        recommended_service="onsite", estimate=est, timeline=_timeline(d, 2026),
        answers={"ERMI": "13.2 (home test)", "room": "Basement", "occupant": "Owner"})
    case.flags = [
        Flag(id="rc_booking_date", check="record_conflict", severity="warn", source="job_timeline.json (Booking event)",
             message="Booking record conflict: calendar entry created Oct 1, but its note says the job was booked Sept 5. Which is correct?"),
        Flag(id="rc_staff_a", check="record_conflict", severity="warn", source="job_timeline.json (people)",
             message="Staff assignment conflict: Staff A is listed as both the booker (client support) and the on-site inspector; "
                     "Staff B is listed as estimator in FreshBooks/Asana/Close. Confirm who inspected."),
    ]
    case.flags = checks.run_all(case)
    return case


def job2() -> Case:
    d = _load("02_Virtual_Sample")
    photos = [Photo(id=f"v{f[:2]}", path=f"02_Virtual_Sample/Photos/{f}", room=room, source="customer", caption_from_pack=caption(f))
              for f, room in JOB2_PHOTOS.items()]
    findings = [Finding(id=f"G{i+1}", room=ph.room, source="inspector_entered", confirmed=True,
                        observation=f"Visible discoloration ({ph.room.lower()}); may be fungal, cannot be confirmed without sampling.",
                        readings=[Reading(kind="visual", result="anomaly", location=ph.room, photo_ids=[ph.id])],
                        evidence_photo_ids=[ph.id]) for i, ph in enumerate(photos)]
    est = build_estimate(est_id="EST-CASE02", service="iaq", areas=["Apartment (air sampling)"], subtotal=Decimal("520"), province="QC",
                         issued_on=date(2025, 9, 8), source="sample_pack", scope_text=d["estimate"]["scope"],
                         duration_text=d["estimate"]["time"], status="viewed",
                         standard_terms=False, extra_terms=["Full payment needed before lab results are released (per recorded scope)"])
    est.real_world_status = d["estimate"]["status"]
    case = Case(
        id=J2, title="Sample Job 2: virtual assessment (Quebec apartment, tenant)", stage="quoted", seeded_from="02_Virtual_Sample",
        customer=Customer(type="tenant", alias="Tenant (Sample Client 02)"),
        property=Property(province="QC", in_service_area=True, type="apartment", region_text=d["property"]),
        concern=d["client_concern"], health_flag=True, photos=photos, findings=findings, recommendations=d["recommendations"],
        recommended_service="iaq", estimate=est, timeline=_timeline(d, 2025),
        answers={"occupant": "Tenant", "symptoms": "Yes", "odor": "Yes", "room": "Laundry"})
    case.flags = [Flag(id="rc_province", check="record_conflict", severity="warn", source="Report_Virtual_Sample.pdf address line (metadata only)",
                       message="Address conflict: the reference report's address line reads 'Sample Property 02, Quebec, ON'. "
                               "Province drives tax (QC 14.975% vs ON 13%). Confirm the province.")]
    case.flags = checks.run_all(case)
    return case


def seed_all(save) -> list[Case]:
    return [save(job1()), save(job2())]
