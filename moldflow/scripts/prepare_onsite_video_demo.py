"""Prepare the on-site video demo once (offline): transcribe the walkthrough clip with a local speech model and extract
frames at the moments the speaker points at something. Output: web/public/demo/onsite/ (frames + transcript.json).

Run: uv run --with faster-whisper python scripts/prepare_onsite_video_demo.py
The app then replays these results when that exact clip is uploaded (the demo shows them step by step)."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLIP = ROOT / "Mold_Busters_Hackathon_Sample_Inspections/01_Virtual_Assessment_Montreal_QC/Videos/02_Walkthrough_clip_client_camera_4m12-7m08.mp4"
OUT = ROOT / "moldflow/web/public/demo/onsite"
OUT.mkdir(parents=True, exist_ok=True)

from faster_whisper import WhisperModel  # noqa: E402

model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(str(CLIP), language="en", vad_filter=True)
lines = [{"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()} for s in segments]
(OUT / "transcript.json").write_text(json.dumps({"source": CLIP.name, "language": info.language, "lines": lines}, indent=1), encoding="utf-8")
print(len(lines), "transcript lines")
for i, t in enumerate([8, 30, 52, 75, 98, 120, 142, 165]):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(CLIP), "-frames:v", "1", "-vf", "scale=720:-2", str(OUT / f"frame_{i + 1:02d}.jpg")], check=True)
print("frames written")
