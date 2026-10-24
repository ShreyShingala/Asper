"""Score the photo agent on the 24 sample-pack photos against api/proof/golden_photos.json.

Reports "agreement with the organizer captions on the sample pack (n=24, illustrative)", NOT accuracy:
the README says the two jobs are worked examples, not a training set or benchmark.
Throttled to 15 req/min for the OpenRouter free tier. Raw analyses are saved, so scoring changes can be re-applied
without new model calls (--rescore).

Usage (from moldflow/api):
  MOLDFLOW_DEMO_MODE=live uv run python ../scripts/eval_photos.py           # measure (24 model calls)
  uv run python ../scripts/eval_photos.py --rescore                         # re-score the last run, no calls
  uv run python ../scripts/eval_photos.py --only thermal,attic              # subset by group"""
import argparse
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

GOLDEN = json.loads((config.API_DIR / "proof" / "golden_photos.json").read_text())
OUT = config.API_DIR / "proof" / "eval_photos.json"
HEDGE = re.compile(r"(\bno\b|\bnot\b|\bnone\b|without|absence|possibl|may |might|could|cannot|can't|can not|not confirm|unconfirm|resembl|suspect|sampling|consistent with|appears?|potential|unclear|unknown)", re.I)
MOLD = re.compile(r"\b(mou?ld|fungal|fungus|mildew)\b", re.I)
SPACING_S = 4.0  # 15 requests/minute
METRICS = ["type", "mentions", "no_overclaim", "regions", "quality", "follow_up", "speakable"]


def overclaims(texts: list[str]) -> bool:
    return any(MOLD.search(t) and not HEDGE.search(t) for t in texts)


def covered(idea: str, text: str) -> bool:
    return any(s in text for s in GOLDEN["synonyms"].get(idea, [idea]))


def score(key: str, a: dict | None) -> dict:
    g = GOLDEN["photos"][key]
    if not a:
        return {m: 0.0 for m in METRICS} | {"total": 0.0, "overclaim": False, "notes": ["no analysis"]}
    obs = a.get("observations", [])
    text = " ".join(obs + [a.get("follow_up_question") or ""] + [r["label"] for r in a.get("regions", [])]).lower()
    notes = []
    s = {"type": float(a.get("image_type") in g["image_type"])}
    hit = [i for i in g["must_mention"] if covered(i, text)]
    s["mentions"] = len(hit) / len(g["must_mention"])
    if s["mentions"] < 1:
        notes.append("missing: " + ", ".join(i for i in g["must_mention"] if i not in hit))
    banned = [b for b in GOLDEN["must_not_global"] + g["must_not"] if b in text]
    over = overclaims(obs + [r["label"] for r in a.get("regions", [])]) or bool(banned) or not a.get("declined_to_confirm_mold", True)
    s["no_overclaim"] = float(not over)
    if over:
        notes.append("OVERCLAIM" + (f": {banned}" if banned else ""))
    regions = a.get("regions", [])
    whole = [r for r in regions if (r["box_2d"][2] - r["box_2d"][0]) * (r["box_2d"][3] - r["box_2d"][1]) > 0.85 * 1e6]
    s["regions"] = float(not whole and (bool(regions) if g["expect_regions"] else True))
    if s["regions"] < 1:
        notes.append("regions: " + ("whole-image box" if whole else "none"))
    s["quality"] = float(a.get("quality") in g["quality"])
    q = (a.get("follow_up_question") or "").strip()
    s["follow_up"] = float(len(q) > 8 and q.endswith("?"))
    long = [o for o in obs if len(o.split()) > 12]
    s["speakable"] = float(bool(obs) and not long and len(obs) <= 4)
    if long:
        notes.append(f"{len(long)} obs >12 words")
    s["total"] = sum(s[m] for m in METRICS)
    return s | {"overclaim": over, "notes": notes}


def summarize(rows: list[dict]) -> dict:
    ok = [r for r in rows if r.get("analysis")]
    groups = {}
    for r in rows:
        groups.setdefault(r["group"], []).append(r["score"]["total"])
    lat = [r["latency_ms"] for r in ok if r["tier"] in ("live", "fallback")]
    return {
        "total score": f"{sum(r['score']['total'] for r in rows):.1f} / {len(rows) * len(METRICS)}",
        "overclaims": sum(r["score"]["overclaim"] for r in rows),
        "image type agreement": f"{sum(r['score']['type'] for r in rows):.0f}/{len(rows)}",
        "photos analysed": f"{len(ok)}/{len(rows)}",
        "median live latency (s)": round(statistics.median(lat) / 1000, 1) if lat else "-",
        "by group (avg of 7)": {g: round(sum(v) / len(v), 2) for g, v in sorted(groups.items())},
        "by metric": {m: f"{sum(r['score'][m] for r in rows):.1f}/{len(rows)}" for m in METRICS},
    }


def table(rows: list[dict]) -> None:
    print(f"{'photo':48} {'grp':10} {'type':10} " + " ".join(m[:5] for m in METRICS) + "  total  s")
    for r in rows:
        s = r["score"]
        print(f"{r['key'][:48]:48} {r['group'][:10]:10} {(r.get('analysis') or {}).get('image_type', '-')[:10]:10} "
              + " ".join(f"{s[m]:5.2f}" for m in METRICS) + f"  {s['total']:4.1f}  {r['latency_ms'] / 1000:4.1f}  {'; '.join(s['notes'])}")


async def run(only: set[str] | None):
    keys = [k for k, g in GOLDEN["photos"].items() if not only or g["group"] in only]
    case = Case(id="eval", title="eval")
    rows: list[dict] = []

    async def one(i: int, key: str):
        await asyncio.sleep(i * SPACING_S)
        job, name = key.split("/")
        path = config.PACK_DIR / ("01_OnSite_Sample" if job == "job1" else "02_Virtual_Sample") / "Photos" / name
        ph = Photo(id=name[:2], path=str(path), source="customer")
        row = {"key": key, "photo": name, "job": job, "group": GOLDEN["photos"][key]["group"],
               "caption": re.sub(r"^\d+_", "", Path(name).stem).replace("_", " ")}
        try:
            res = await tasks.analyze_photo(case, ph, prepare_image(path.read_bytes()), None, fixture_key=None)  # measure: no fixture fallback
            row |= {"analysis": res.value.model_dump(), "tier": res.usage.tier, "latency_ms": res.usage.latency_ms, "model": res.usage.model}
        except Exception as e:  # one bad provider response must not lose the run
            row |= {"analysis": None, "tier": "error", "latency_ms": 0, "error": str(e)[:160]}
        rows.append(row)
        print(f"  {key:50} {row['tier']:8} {row['latency_ms'] / 1000:5.1f}s", flush=True)

    await asyncio.gather(*[one(i, k) for i, k in enumerate(keys)])
    return sorted(rows, key=lambda r: r["key"])


def write(rows: list[dict], label: str | None) -> dict:
    for r in rows:
        r["score"] = score(r["key"], r.get("analysis"))
        r |= {"image_type": (r.get("analysis") or {}).get("image_type", "-"), "observations": (r.get("analysis") or {}).get("observations", []),
              "regions": len((r.get("analysis") or {}).get("regions", [])),
              "declined_to_confirm_mold": not r["score"]["overclaim"], "mentions_mold_as_fact": r["score"]["overclaim"]}
    summary = summarize(rows)
    out = {"model": config.PRIMARY_MODEL, "run_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "label": label, "rows": rows, "summary": summary,
           "note": "Agreement with the organizer captions on the sample pack (n=24, illustrative). Not an accuracy benchmark."}
    OUT.write_text(json.dumps(out, indent=1, default=str))
    table(rows)
    print(json.dumps(summary, indent=1))
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--rescore", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--label")
    a = ap.parse_args()
    if a.rescore:
        prev = json.loads(OUT.read_text())
        write(prev["rows"], a.label or prev.get("label"))
    else:
        write(asyncio.run(run(set(a.only.split(",")) if a.only else None)), a.label)
