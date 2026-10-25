"""Prepare the on-site video demo from a real Mold Busters walkthrough (Stittsville bathroom, sample inspections vol 2.1).

Cuts 0:44-5:04 of the call (the part where the engineer reviews the bathroom on the client's camera) into
demo-videos/Stittsville_bathroom_walkthrough.mp4 (the file to upload in the demo), transcribes it locally with
faster-whisper and extracts the frames the demo shows. Output: web/public/demo/onsite-stittsville/.

Run: uv run --with faster-whisper --with "av<14" python scripts/prepare_stittsville_demo.py"""
import json
import subprocess
from pathlib import Path

from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "Mold_Busters_Hackathon_Sample_Inspections/06_Virtual_Assessment_Stittsville_ON_Zendesk/Videos/VA_call_recording_8min.mp4"
CLIP = ROOT / "demo-videos/Stittsville_bathroom_walkthrough.mp4"
OUT = ROOT / "moldflow/web/public/demo/onsite-stittsville"
START, LENGTH = 44, 260
FRAMES = [8, 20, 36, 68, 116, 161, 196, 246]  # seconds into the clip

CLIP.parent.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(START), "-t", str(LENGTH), "-i", str(SRC), "-c:v", "libx264", "-preset", "veryfast",
                "-crf", "28", "-c:a", "aac", "-b:a", "64k", str(CLIP)], check=True)
segments, _ = WhisperModel("base", device="cpu", compute_type="int8").transcribe(str(CLIP), language="en", vad_filter=True)
lines = [{"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()} for s in segments]
(OUT / "transcript.json").write_text(json.dumps({"source": CLIP.name, "size": CLIP.stat().st_size, "lines": lines}, indent=1), encoding="utf-8")
for i, t in enumerate(FRAMES):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", str(CLIP), "-frames:v", "1", "-vf", "scale=-2:720", str(OUT / f"frame_{i + 1:02d}.jpg")], check=True)
print(len(lines), "lines;", CLIP.stat().st_size, "bytes")
