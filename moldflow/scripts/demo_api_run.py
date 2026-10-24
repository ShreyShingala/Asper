"""Runs the whole demo path against the API. Must pass before every rehearsal.
Usage: uv run --project api python scripts/demo_api_run.py [--base http://localhost:8000] [--no-reset]"""
import argparse
import sys
import time

import httpx

ap = argparse.ArgumentParser()
ap.add_argument("--base", default="http://localhost:8000")
ap.add_argument("--no-reset", action="store_true")
args = ap.parse_args()
c = httpx.Client(base_url=args.base, timeout=120)
T0 = time.time()


def step(name, fn):
    t = time.time()
    try:
        out = fn()
    except Exception as e:
        print(f"FAIL  {name}: {e}")
        sys.exit(1)
    print(f"ok    {name}  ({time.time() - t:.1f}s)")
    return out


def post(path, **kw):
    r = c.post(path, **kw)
    if r.status_code >= 400:
        raise RuntimeError(f"{r.status_code} {r.text[:300]}")
    return r.json()


if not args.no_reset:
    step("reset", lambda: post("/admin/reset"))

# --- Beat 2: customer pre-assessment (tenant, Quebec) using sample photos ---
cid = step("create case", lambda: post("/cases", json={"language": "en"}))["case"]["id"]
out = step("sample photos (3, analyzed in parallel)", lambda: post(f"/cases/{cid}/sample-photos"))
photos = out["case"]["photos"]
assert all(p["analysis"] for p in photos), "photo analysis missing"
print("      regions:", [len(p["analysis"]["regions"]) for p in photos], "tiers:", [p["analysis_tier"] for p in photos])
for k, v in [("room", "Laundry"), ("occupant", "Tenant"), ("symptoms", "Yes"), ("odor", "Yes"), ("leak", "Not sure")]:
    out = post(f"/cases/{cid}/answers", json={"key": k, "value": v})
while out["turn"] and out["turn"].get("photo_prompt"):
    out = post(f"/cases/{cid}/skip-photo", json={"prompt_id": out["turn"]["photo_prompt"]["prompt_id"]})
out = step("answer location (QC)", lambda: post(f"/cases/{cid}/answers", json={"key": "location", "value": "H2X 1Y4"}))
assert out["turn"]["ready"], out["turn"]
pa = step("pre-assessment", lambda: post(f"/cases/{cid}/pre-assessment"))["case"]
print("      service:", pa["recommended_service"], "|", pa["pre_assessment"]["service_price_text"])
assert pa["recommended_service"] == "iaq", "tenant+symptoms+odour should route to IAQ"
assert pa["pre_assessment"]["health_note"]
step("landlord letter (FR)", lambda: post(f"/cases/{cid}/letters/landlord", json={"language": "fr"}))
step("pre-assessment PDF", lambda: c.get(f"/cases/{cid}/export/pre-assessment.pdf").raise_for_status())
step("book (simulated)", lambda: post(f"/cases/{cid}/book", json={"service": "iaq", "slot_text": "Tomorrow 9:00"}))
# out-of-area route
cid2 = post("/cases", json={"language": "en"})["case"]["id"]
post(f"/cases/{cid2}/sample-photos")
for k, v in [("room", "Laundry"), ("occupant", "Owner"), ("symptoms", "No"), ("odor", "No"), ("leak", "No"), ("location", "Australia")]:
    post(f"/cases/{cid2}/answers", json={"key": k, "value": v})
r = step("out-of-area pre-assessment", lambda: post(f"/cases/{cid2}/pre-assessment"))["case"]
assert r["recommended_service"] == "remote_report", r["recommended_service"]

# --- Beat 3: staff, Job 1 ---
out = step("inspector note -> findings", lambda: post("/cases/job1/findings/from-note",
           json={"room": "Upstairs washrooms", "text": "Tub faucet leaking, moisture meter shows elevated moisture below the faucet."}))
ai = [f for f in out["case"]["findings"] if f["source"] == "ai_structured"]
assert ai, "no AI finding produced"
print("      AI finding:", ai[0]["observation"], ai[0]["readings"], ai[0]["evidence_photo_ids"])
for f in ai:
    post(f"/cases/job1/findings/{f['id']}", json={}) if False else c.patch(f"/cases/job1/findings/{f['id']}", json={"confirmed": True}).raise_for_status()
out = step("draft report", lambda: post("/cases/job1/report/draft"))
blocks = [f for f in out["case"]["flags"] if f["severity"] == "block" and not f["resolved"]]
print("      blocks:", [b["message"][:70] for b in blocks])
assert any(b["check"] == "scope" for b in blocks), "scope block should fire for basement"
r = c.post("/cases/job1/approve", json={"what": "report", "reviewed_by": "Staff D"})
assert r.status_code == 409, "approval must be blocked"
print("ok    approval blocked while scope flag open (409)")
for b in blocks:
    post(f"/cases/job1/flags/{b['id']}/resolve", json={"note": "Basement spot is small and under the sink; homeowner can clean it with guidance. "
                                                               "Exclusion explained in the report.", "by": "Staff B"})
step("approve report", lambda: post("/cases/job1/approve", json={"what": "report", "reviewed_by": "Staff D"}))
step("report PDF", lambda: c.get("/cases/job1/export/report.pdf").raise_for_status())
step("estimate CSV", lambda: c.get("/cases/job1/export/estimate.csv").raise_for_status())

# --- Beat 4: follow-up ---
out = step("follow-up draft (as of Oct 9)", lambda: post("/cases/job1/followups/draft", json={"as_of": "2026-10-09"}))
fu = out["case"]["followups"][-1]
print("      SMS:", fu["body"])
step("compare", lambda: c.get("/compare/job1").raise_for_status())
step("dashboard", lambda: c.get("/dashboard").raise_for_status())
print(f"\nDEMO PATH PASSED in {time.time() - T0:.1f}s")
