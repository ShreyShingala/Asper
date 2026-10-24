#!/usr/bin/env bash
# Convert the sample walkthrough into a Chromium fake-camera file for the Playwright live-mode tests.
# Output (git-ignored): web/e2e/.media/walkthrough.y4m   (~480 MB, regenerate any time)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/../Mold-Busters-Hackathon-Sample-Pack-v2/02_Virtual_Sample/Videos/Walkthrough_Silent.mp4"
OUT="$ROOT/web/e2e/.media/walkthrough.y4m"
mkdir -p "$(dirname "$OUT")"
[[ -f "$OUT" && "$OUT" -nt "$SRC" ]] && { echo "up to date: $OUT"; exit 0; }
ffmpeg -loglevel error -y -i "$SRC" -pix_fmt yuv420p "$OUT"
echo "wrote $OUT"
