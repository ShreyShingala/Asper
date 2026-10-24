"""Run the photo agent on frames of the sample walkthrough video (288x640, low-res, silent): the closest stand-in for what
Bruce captures on a real call. Labels below were set by a human looking at each frame (never from the reports).
Checks: unusable frames are flagged (too_dark / blurry / not_relevant) instead of over-described; steady frames of the
vents/hoses give observations consistent with the 3 still photos; no overclaims. Illustrative only.

Usage (from moldflow/api):
  uv run python ../scripts/eval_frames.py --extract          # ffmpeg 1 frame / 3 s into api/proof/frames (git-ignored)
  MOLDFLOW_DEMO_MODE=live uv run python ../scripts/eval_frames.py
  uv run python ../scripts/eval_frames.py --rescore"""
import argparse
import asyncio
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from eval_photos import covered, overclaims  # noqa: E402
from app import config  # noqa: E402
from app.agents import tasks  # noqa: E402
from app.agents.llm import AgentFailure, prepare_image  # noqa: E402
from app.models.passport import Case, Photo  # noqa: E402

VIDEO = config.PACK_DIR / "02_Virtual_Sample/Videos/Walkthrough_Silent.mp4"
FRAMES = config.API_DIR / "proof" / "frames"
OUT = config.API_DIR / "proof" / "eval_frames.json"
SPACING_S = 4.0
UNUSABLE = {1: "selfie / face", 2: "selfie / face", 33: "blank wall, out of focus", 34: "blank wall, out of focus",
            40: "cardboard boxes", 41: "cardboard boxes", 42: "cardboard boxes"}  # (f59 is a baseboard, not black)
CONSISTENT = {**{i: ["hose"] for i in range(12, 18)}, **{i: ["vent"] for i in range(20, 25)}, **{i: ["vent"] for i in range(35, 39)}}


def extract():
    FRAMES.mkdir(parents=True, exist_ok=True)
    for f in FRAMES.glob("f_*.jpg"):
        f.unlink()
    subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(VIDEO), "-vf", "fps=1/3", str(FRAMES / "f_%03d.jpg")], check=True)
    print(len(list(FRAMES.glob("f_*.jpg"))), "frames")


def score(i: int, a: dict | None) -> dict:
    if not a:
        return {"ok": False, "kind": "error", "overclaim": False, "notes": ["no analysis"]}
    obs = a["observations"]
    over = overclaims(obs + [r["label"] for r in a.get("regions", [])])
    if i in UNUSABLE:
        ok = a["quality"] in ("too_dark", "blurry", "not_relevant")
        return {"ok": ok and not over, "kind": "unusable", "overclaim": over, "notes": [] if ok else [f"should flag ({UNUSABLE[i]}), got {a['quality']}"]}
    if i in CONSISTENT:
        text = " ".join(obs + [r["label"] for r in a.get("regions", [])]).lower()
        hit = all(covered(idea, text) for idea in CONSISTENT[i])
        ok = hit and a["quality"] in ("ok", "blurry")
        return {"ok": ok and not over, "kind": "consistent", "overclaim": over, "notes": [] if ok else [f"expected {CONSISTENT[i]}, quality {a['quality']}"]}
    return {"ok": not over, "kind": "other", "overclaim": over, "notes": []}


async def run() -> list[dict]:
    files = sorted(FRAMES.glob("f_*.jpg"))
    case = Case(id="eval", title="eval")
    rows = []

    async def one(n: int, f: Path):
        await asyncio.sleep(n * SPACING_S)
        i = int(f.stem[2:])
        row = {"frame": i, "t_s": (i - 1) * 3}
        try:
            res = await tasks.analyze_photo(case, Photo(id=f.stem, path=str(f), source="customer"), prepare_image(f.read_bytes()),
                                            "Live camera frame from a customer's phone", fixture_key=None)
            row |= {"analysis": res.value.model_dump(), "tier": res.usage.tier, "latency_ms": res.usage.latency_ms}
        except Exception as e:  # one bad provider response must not lose the run
            row |= {"analysis": None, "tier": "error", "latency_ms": 0, "error": str(e)[:120]}
        rows.append(row)
        print(f"  f{i:03d} {row['tier']:8} {(row.get('analysis') or {}).get('quality', '-'):12} {'; '.join((row.get('analysis') or {}).get('observations', [])[:1])[:80]}", flush=True)

    await asyncio.gather(*[one(n, f) for n, f in enumerate(files)])
    return sorted(rows, key=lambda r: r["frame"])


def write(rows: list[dict], label: str | None):
    for r in rows:
        r["score"] = score(r["frame"], r.get("analysis"))
    by = lambda k: [r for r in rows if r["score"]["kind"] == k]  # noqa: E731
    summary = {
        "unusable frames flagged": f"{sum(r['score']['ok'] for r in by('unusable'))}/{len(by('unusable'))}",
        "vent/hose frames consistent with stills": f"{sum(r['score']['ok'] for r in by('consistent'))}/{len(by('consistent'))}",
        "overclaims": sum(r["score"]["overclaim"] for r in rows),
        "frames analysed": f"{sum(1 for r in rows if r.get('analysis'))}/{len(rows)}",
        "quality flags": {q: sum(1 for r in rows if (r.get("analysis") or {}).get("quality") == q) for q in ("ok", "blurry", "too_dark", "not_relevant")},
    }
    OUT.write_text(json.dumps({"run_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "label": label, "summary": summary, "rows": rows,
                               "note": "Walkthrough frames every 3 s; labels set by a human. Illustrative."}, indent=1))
    for r in rows:
        if not r["score"]["ok"] or r["score"]["kind"] != "other":
            print(f"f{r['frame']:03d} {r['score']['kind']:10} {'OK ' if r['score']['ok'] else 'BAD'} {'; '.join(r['score']['notes'])}")
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", action="store_true")
    ap.add_argument("--rescore", action="store_true")
    ap.add_argument("--label")
    a = ap.parse_args()
    if a.extract:
        extract()
    elif a.rescore:
        write(json.loads(OUT.read_text())["rows"], a.label)
    else:
        write(asyncio.run(run()), a.label)
