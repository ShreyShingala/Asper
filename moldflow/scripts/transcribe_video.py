"""Transcribe a video locally (faster-whisper, base model, CPU) and save a contact sheet of frames, to pick a demo segment.

Run: uv run --with faster-whisper --with "av<14" python scripts/transcribe_video.py <video> <out_dir>"""
import json
import subprocess
import sys
from pathlib import Path

from faster_whisper import WhisperModel

video, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
segments, _ = WhisperModel("base", device="cpu", compute_type="int8").transcribe(str(video), language="en", vad_filter=True)
lines = [{"start": round(s.start, 1), "end": round(s.end, 1), "text": s.text.strip()} for s in segments]
(out / "full_transcript.json").write_text(json.dumps(lines, indent=1), encoding="utf-8")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf", "fps=1/30,scale=240:-2,tile=8x5", "-frames:v", "1", str(out / "contact_sheet.jpg")], check=True)
print(len(lines), "lines")
