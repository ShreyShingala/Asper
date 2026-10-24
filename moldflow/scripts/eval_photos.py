"""Run the photo agent over all 24 sample photos and compare with the organizer's captions (filenames).
Illustrative only (n=24, mostly non-mold images): NOT an accuracy benchmark. Throttled for the 20 req/min free tier.
Usage (from moldflow/api): uv run python ../scripts/eval_photos.py"""
import asyncio
import json
import re
import statistics
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from app import config  # noqa: E402
from app.agents import tasks  # noqa: E402
from app.agents.llm import AgentFailure, prepare_image  # noqa: E402
from app.models.passport import Case, Photo  # noqa: E402

HEDGE = re.compile(r"(\bno\b|\bnot\b|\bnone\b|without|absence|possibl|may |might|could|cannot|can't|can not|not confirm|unconfirm|resembl|suspect|sampling|consistent with|appears?|potential)", re.I)
MOLD = re.compile(r"\b(mou?ld|fungal|fungus)\b", re.I)


def overclaims(obs: list[str]) -> bool:
    return any(MOLD.search(o) and not HEDGE.search(o) for o in obs)


async def main():
    photos = sorted((config.PACK_DIR / "01_OnSite_Sample/Photos").glob("*.jpg")) + sorted((config.PACK_DIR / "02_Virtual_Sample/Photos").glob("*.jpg"))
    case = Case(id="eval", title="eval")
    rows = []

    async def one(i: int, path: Path):
        await asyncio.sleep(i * 3.2)
        caption = re.sub(r"^\d+_", "", path.stem).replace("_", " ")
        job = "job1" if "OnSite" in str(path) else "job2"
        ph = Photo(id=path.stem[:2], path=str(path), source="customer")
        try:
            res = await tasks.analyze_photo(case, ph, prepare_image(path.read_bytes()), None, fixture_key=f"eval:{job}:{path.name}")
            a = res.value
            rows.append({"photo": path.name, "job": job, "caption": caption, "image_type": a.image_type, "observations": a.observations,
                         "regions": len(a.regions), "declined_to_confirm_mold": a.declined_to_confirm_mold,
                         "mentions_mold_as_fact": overclaims(a.observations), "tier": res.usage.tier, "latency_ms": res.usage.latency_ms,
                         "model": res.usage.model})
            print(f"{path.name:45} {res.usage.tier:8} {res.usage.latency_ms/1000:5.1f}s  {a.image_type:10} overclaim={overclaims(a.observations)}")
        except AgentFailure as e:
            rows.append({"photo": path.name, "job": job, "caption": caption, "image_type": "-", "observations": [], "regions": 0,
                         "declined_to_confirm_mold": False, "mentions_mold_as_fact": False, "tier": "error", "latency_ms": 0, "error": str(e)[:120]})
            print(path.name, "ERROR", str(e)[:120])

    await asyncio.gather(*[one(i, p) for i, p in enumerate(photos)])
    rows.sort(key=lambda r: (r["job"], r["photo"]))
    ok = [r for r in rows if "error" not in r]
    thermal = [r for r in ok if "thermal" in r["caption"].lower()]
    live_lat = [r["latency_ms"] for r in ok if r["tier"] in ("live", "fallback")]
    summary = {
        "photos analysed": f"{len(ok)}/{len(rows)}",
        "declined to confirm mold": f"{sum(r['declined_to_confirm_mold'] and not r['mentions_mold_as_fact'] for r in ok)}/{len(ok)}",
        "overclaims (mold stated as fact)": sum(r["mentions_mold_as_fact"] for r in ok),
        "median live latency (s)": round(statistics.median(live_lat) / 1000, 1) if live_lat else "-",
    }
    if thermal:
        summary["thermal/instrument photos recognised"] = f"{sum(r['image_type'] in ('thermal', 'instrument') for r in thermal)}/{len(thermal)}"
    out = {"model": config.PRIMARY_MODEL, "run_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "rows": rows, "summary": summary,
           "note": "Illustrative (n=24), not an accuracy benchmark. Ground truth = organizer photo filenames."}
    dest = config.API_DIR / "proof" / "eval_photos.json"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(json.dumps(out, indent=1))
    print(json.dumps(summary, indent=1))


if __name__ == "__main__" and "--rescore" in sys.argv:
    dest = config.API_DIR / "proof" / "eval_photos.json"
    d = json.loads(dest.read_text())
    for r in d["rows"]:
        r["mentions_mold_as_fact"] = overclaims(r["observations"])
    ok = [r for r in d["rows"] if "error" not in r]
    d["summary"]["declined to confirm mold"] = f"{sum(r['declined_to_confirm_mold'] and not r['mentions_mold_as_fact'] for r in ok)}/{len(ok)}"
    d["summary"]["overclaims (mold stated as fact)"] = sum(r["mentions_mold_as_fact"] for r in ok)
    dest.write_text(json.dumps(d, indent=1))
    print(json.dumps(d["summary"], indent=1))
else:
    asyncio.run(main())
