"""Real walkthrough clips prepared offline for the on-site video demo (scripts/prepare_stittsville_demo.py and
scripts/prepare_onsite_video_demo.py): frames, a local Whisper transcript and the moments the engineer points at."""
import json
from pathlib import Path

from app import config

DEMO_WEB = config.PACK_DIR.parent / "moldflow/web/public/demo"

PREPARED = {
    "stittsville": {
        "dir": "onsite-stittsville", "match": "stittsville", "frames": [8, 20, 36, 68, 116, 161, 196, 246], "duration": 260,
        "contact": "c-stitts", "title": "On-site walkthrough · Stittsville bathroom", "type": "homeowner", "alias": "Stittsville client (homeowner)",
        "concern": "Mold on the bathroom ceiling above the shower and around the edge of the bathtub where the caulking is.",
        "province": "ON", "fsa": "K2S", "address": "109 Stoney Pond Ct, Stittsville, ON",
        "moments": [
            (0, 29, "Shower ceiling", "Visible discoloration along the seam where the shower tile meets the drywall ceiling.", ("visual", "anomaly")),
            (30, 61, "Shower walls", "Middle of the ceiling is clear; one shower wall is exterior (a colder surface). Client can't reach to clean it; no health issues reported.", None),
            (62, 78, "Bathtub", "Discoloration along the silicone sealant around the bathtub.", ("visual", "anomaly")),
            (79, 172, "Bathtub", "Shower humidity condenses on the cooler ceiling seam; contamination looks low-level and local, so topical treatment should be enough.", None),
            (173, 221, "Bathtub edge", "The silicone has aged: cracks and capillary openings let water and skin cells in, which feeds growth.", ("visual", "anomaly")),
            (222, 260, "Exhaust fan", "Fan is used regularly; check that it really moves air (tissue test on the grille).", None)],
        "fields": {"Property": "109 Stoney Pond Ct, Stittsville, ON", "Client": "Homeowner (returning contact)",
                   "Areas": "Bathroom: shower ceiling seam, tub surround, exhaust fan",
                   "Concern": "Mold on the ceiling above the shower and along the tub caulking",
                   "Moisture / source": "Shower humidity condensing on the ceiling seam at an exterior wall; aged silicone letting water in",
                   "Recommended service": "Bathroom remediation: remove silicone, treat tiles, grout and ceiling (about 4 h)"},
        "recs": ["Remove the silicone sealant; treat tiles, grout and the drywall ceiling", "Re-seal the tub with new silicone once dry",
                 "Keep humidity at 30-50%; make sure the fan works (tissue test) and run it 20 minutes after showers"]},
    "montreal": {
        "dir": "onsite", "match": "walkthrough_clip", "frames": [8, 30, 52, 75, 98, 120, 142, 165], "duration": 176, "size": 10408780,
        "contact": "c-job2", "title": "Walkthrough · Montréal laundry & kitchen", "type": "tenant", "alias": "Montreal client (walkthrough video)",
        "concern": "Mold inside the washing machine and around the washer and dryer; smell.", "province": "QC", "fsa": "H2X", "address": "Apartment, Montréal, QC",
        "moments": [
            (0, 12, "Laundry", "Black and white discoloration inside the washing machine drum and door seal.", ("visual", "anomaly")),
            (13, 46, "Laundry", "Discoloration around the washer's power cable and outlet; camera focus poor, re-shot from farther away.", None),
            (47, 53, "Laundry", "Visible discoloration confirmed on the wall surface beside the washer.", ("visual", "anomaly")),
            (54, 117, "Laundry", "Ceiling ventilation duct with dark discoloration inside; occupant reports it gets worse when the ventilation runs.", ("visual", "anomaly")),
            (118, 127, "Laundry", "Cardboard boxes brought in the day before: no discoloration, not a source.", None),
            (128, 142, "Kitchen", "Abandoned food found behind removed kitchen cabinets: an organic food source for growth.", None),
            (143, 176, "Kitchen", "Dust or dark speckles around the oven and microwave area.", ("visual", "anomaly"))],
        "fields": {"Property": "Apartment, Montréal, QC", "Client": "Tenant", "Areas": "Laundry room, kitchen",
                   "Concern": "Mold inside the washer and around the washer and dryer; smell",
                   "Moisture / source": "Ventilation duct (worse when running); abandoned food behind cabinets",
                   "Recommended service": "Indoor air quality test + remediation of the laundry area"},
        "recs": ["Professional remediation of the laundry area: washer surroundings, wall and the ventilation duct",
                 "Clean or replace the ventilation duct; check where it exhausts", "Remove the abandoned food and clean behind the kitchen cabinets",
                 "Indoor air quality test, since the smell persists after cleaning"]},
}


def match(filename: str, size: int) -> tuple[str, dict] | None:
    for key, cfg in PREPARED.items():
        tj = DEMO_WEB / cfg["dir"] / "transcript.json"
        known = cfg.get("size") or (json.loads(tj.read_text(encoding="utf-8")).get("size") if tj.is_file() else None)
        if cfg["match"] in filename.lower() or size == known:
            return key, cfg
    return None


def transcript(cfg: dict) -> list[dict]:
    return json.loads((DEMO_WEB / cfg["dir"] / "transcript.json").read_text(encoding="utf-8"))["lines"]
