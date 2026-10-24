#!/usr/bin/env bash
# Public HTTPS URL for the phone camera (getUserMedia/capture needs HTTPS). Prints a *.trycloudflare.com URL.
# Start this 30 min before the demo and keep it running; the URL changes on every restart.
exec cloudflared tunnel --url http://localhost:3000 --no-autoupdate
