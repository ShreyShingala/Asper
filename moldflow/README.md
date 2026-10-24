# MoldFlow: from first concern to verified quote

One continuous AI workflow for Mold Busters, built around an **Evidence Passport**: a single case record
(Pydantic v2) that the customer pre-assessment, inspector, report/estimate review and follow-up all read and write.
Plan and red-team history: [`../plan/PLAN.md`](../plan/PLAN.md), [`../plan/REDTEAM_LOG.md`](../plan/REDTEAM_LOG.md).

## Run it
```bash
# one-time
cd api && uv sync && cd ../web && npm install && cd ..
echo "OPENROUTER_API_KEY=sk-or-..." > api/.env.local      # gitignored
# optional: live camera + voice mode ("Go live with AI")
echo "ELEVENLABS_API_KEY=sk_..." >> api/.env.local          # needs ElevenAgents write + Voices read
cd api && uv run python ../scripts/setup_elevenlabs_agent.py && cd ..   # creates the agent, writes ELEVENLABS_AGENT_ID
# every time
scripts/dev.sh            # API :8000 + web :3000 (dev)
scripts/dev.sh prod       # production build (use this for the demo)
scripts/tunnel.sh         # HTTPS URL for phones
```
Open http://localhost:3000 (customer) and http://localhost:3000/dashboard (staff).

| Env var (api) | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | from `api/.env.local` | OpenRouter key |
| `PRIMARY_MODEL` / `FALLBACK_MODEL` | `nvidia/nemotron-3.5-super-vl:free` / `openrouter/free` | models |
| `MOLDFLOW_DEMO_MODE` | `hybrid` | `hybrid` = cache -> live -> fallback -> fixture; `fixture` = offline replay; `live` = always call the model |
| `DISABLE_REASONING` | `1` | turn off model reasoning on the primary model (about 3x faster) |
| `MOLDFLOW_DATA_DIR` | `api/data` | SQLite + uploads |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_ID` | unset | live mode; the "Go live" button only shows when both are set |
| `LIVE_MAX_PHOTOS` / `LIVE_MAX_SECONDS` | `6` / `300` | per-call limits (re-run the setup script after changing seconds) |

Live mode: the browser talks to an ElevenLabs agent ("Bruce") over a signed URL minted by the API (the key stays server-side).
The agent drives the conversation and calls four client tools in the browser: `get_checklist`, `save_answer`,
`capture_photo` (steady frame -> `/photos` -> photo analysis) and `finish_assessment`. What still has to be collected and
which answers are valid comes from `api/app/engine/live.py`, built on the same rules as the tap-through intake. On-device
checks (dark / shaky video) are sent to the agent as `[camera]` context. The transcript and an AI summary are saved on the
case (`case.live`), shown in staff Review and included in the PDFs. Phones need HTTPS for the camera (`scripts/tunnel.sh`).

## Verify
```bash
cd api && uv run pytest -q                          # 23 unit tests (pricing, checks, routing, guardrails, live rules)
uv run python ../scripts/demo_api_run.py            # whole demo path via the API; must pass before each rehearsal
uv run python ../scripts/eval_photos.py             # proof page: AI vs organizer captions on all 24 photos (~90 s)
cd ../web && npx tsc --noEmit && npx eslint src && npx next build
```
Offline check: run the API with `MOLDFLOW_DEMO_MODE=fixture OPENROUTER_API_KEY=x`; `demo_api_run.py` must still pass (fixtures in `api/cache/fixtures`).

## MoldFlow Hub (relationship engine)
Staff home is `/hub`. Everything except the inspection itself: instant answers to inbound texts, estimate follow-ups that answer
the customer's own question, facts learned from calls/texts/notes/bookings (with the customer's exact words), one timeline across
Google Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email, weather-alert check-ins, an inspector day sheet and a
lab-result explainer. Plan + the 4 red-team reviews: `../plan/HUB_PLAN.md`.

| Route | What |
|---|---|
| `/hub` | needs-you counts, money on the table (open / at-risk estimates, chased -> replied -> accepted, $ recovered), today, inbound, coming up, demo controls |
| `/people`, `/people/[id]` | directory; profile with talking points, facts (approve / edit / delete, source quote), consent, moments, unified timeline, take over / hand back |
| `/outreach` | approval queue (batch approve; anything with $ or personal facts is locked), blocked/held with reasons, sent, inbound, calls & tasks |
| `/alerts` | live Environment Canada check + simulate a rainfall warning over a real forecast zone; offer vs safety-only drafts by consent |
| `/schedule` | inspector day sheet (phone-first, printable) |
| `/research` | mould library + "explain a lab result" (cited; never from photos) |
| `/settings` | autonomy per message type, kill switch, data processors |
| `/privacy` | customer-facing notice EN/FR |

Rules enforced in code (`api/app/engine/consent.py`, `models/crm.py`): CASL consent basis + expiry (implied: 2 years after a
purchase, 6 months after an inquiry), check-ins with an offer only with consent (safety-only otherwise), STOP/ARRÊT +
suppression list, HUMAN hands the thread to a person, quiet hours 21:00-09:00, 1 marketing message per 7 days, identity +
unsubscribe + AI-assistant footer on every message, health facts never in messages, household facts are human talking points
only, booking-form consent box unchecked by default, kill switch. Sending is simulated (`sent_simulated`) until Twilio/Resend
keys exist (`messaging._deliver` is the seam).

Every hub AI agent (`api/app/agents/hub.py`) has a reviewed rule-based fallback, labelled "Template" in the UI, and the LLM
wrapper stops calling the provider for the day once the free quota is used up, so the whole loop works offline.
Demo data: 28 synthetic customers (labelled) + the 2 sample-pack customers; `POST /admin/reset` reseeds; `POST /admin/clock
{"today": "2027-02-01"}` time-travels for moments.

## AI evaluation tooling (overnight work, see `../plan/OVERNIGHT_LOG.md`)
All scores are **agreement with the organizer captions on the sample pack (n=24, illustrative)**, never "accuracy".
Reference report PDFs are never sent to a model. OpenRouter free tier: scripts throttle to 15 req/min (`LLM_RPM`).
```bash
cd api
MOLDFLOW_DEMO_MODE=live uv run python ../scripts/eval_photos.py --label x   # 24 photos vs proof/golden_photos.json (7 checks each)
uv run python ../scripts/eval_photos.py --rescore                           # re-score the last run, no model calls
uv run python ../scripts/eval_frames.py --extract                           # walkthrough video -> 1 frame / 3 s
MOLDFLOW_DEMO_MODE=live uv run python ../scripts/eval_frames.py             # unusable frames flagged? vents consistent with stills?
uv run --with numpy python ../scripts/camera_thresholds.py                  # tune DARK_LUMA / MOVING_DIFF on the walkthrough
LLM_RPM=11 uv run python ../scripts/simulate_call.py --persona all          # Bruce: 8 sample-pack personas, auto-scored
uv run python ../scripts/simulate_call.py --backend elevenlabs --persona job2-virtual [--audio]   # real agent (needs ElevenLabs key, costs credits)
cd ../web && npm run test:e2e                                               # Playwright: walkthrough as fake camera, ElevenLabs mocked, 3 device sizes
```
- `simulate_call.py --backend local` runs the same prompt/first message/tool contracts as `setup_elevenlabs_agent.py` on the
  free OpenRouter model (text, different LLM): useful for regression, but **not verified with a live call**.
- Results land in `api/proof/eval_photos.json`, `eval_frames.json`, `eval_calls.json` and show on `/proof`.
- `scripts/make_fake_camera.sh` regenerates `web/e2e/.media/walkthrough.y4m` (git-ignored, ~480 MB). E2E runs its own API
  (`MOLDFLOW_E2E_STUB=1`, canned AI outputs, zero model calls) on :8010 and Next on :3100 with `NEXT_DIST_DIR=.next-e2e`.
- `/try` shows a big QR for visitors: set `NEXT_PUBLIC_PUBLIC_URL` to the HTTPS tunnel URL from `scripts/tunnel.sh`.

## What's where
- `api/app/models/passport.py`: the Evidence Passport. `models/agents.py`: Pydantic output model for every AI call.
- `api/app/agents/llm.py`: the only AI entry point (schema prompt, validate, up to 2 repairs, model fallback, exact + fixture cache, usage/provenance).
- `api/app/agents/tasks.py`: photo, pre-assessment, note->findings (with a grounding check), report (uncited claims removed), follow-up (offer check, SMS trim).
- `api/app/engine/`: deterministic pricing (`pricing.yaml`, documented prices only), routing/health/letter rules, validation checks.
- `api/app/seed/seeds.py`: Job 1/2 from `job_timeline.json` + photo filenames (reference reports never used as input).
- `web/src/app`: `/` landing, `/assess/[id]` customer flow, `/dashboard`, `/cases/[id]/inspect`, `/cases/[id]/review`, `/compare`, `/proof`.

## Demo runbook (4:15)
**T-60 min:** `scripts/dev.sh prod` -> `curl -X POST localhost:8000/admin/reset` -> `demo_api_run.py` passes -> `scripts/tunnel.sh`,
open the QR (staff header -> "Customer link / QR") on your phone and complete one pre-assessment -> reset again -> open tabs:
dashboard, `/cases/job1/inspect`, `/cases/job1/review`, `/compare`, `/proof` · projector zoom 125% · copy the faucet note.

1. **0:00 Before.** "Customer emails photos at 11 pm, report arrives 45h after the inspection, four generic texts, both estimates ($4,779) viewed and not accepted."
2. **0:30 Customer (phone).** QR -> photo -> highlights + observations (note the *Live AI* pill) -> taps: Laundry / Tenant / symptoms Yes ->
   recommendation **IAQ $520** with reasons + health note + **landlord letter**. Toggle **FR**. "Different location?" -> `Australia` -> **$25 remote report**.
   *Any hiccup:* "Use sample photos".
3. **2:00 Staff (Job 1).** Inspect -> Upstairs washrooms -> paste *"Tub faucet leaking, moisture meter shows elevated moisture below the faucet."* -> Structure with AI -> Confirm.
   Review -> Draft report (every sentence cites evidence; hover a chip) -> **approval locked**: "basement swab positive but not in scope" ->
   Resolve with note -> Approve as Staff D -> PDF.
4. **3:15 Before/After.** Generic texts vs MoldFlow's follow-up answering "where is it coming from?" + Dec 6 expiry.
5. **4:00 Close.** Hold up the PDF. "Real: everything you saw. Simulated: sending, booking, payment, CRM sync." -> Proof page if asked.

Checkpoints: at the staff screen by 2:00 (else drop FR + $25), at compare by 3:15 (else say the follow-up line verbally).

| Failure | Fallback |
|---|---|
| Tunnel/QR dead | phone on hotspot -> else laptop localhost ("same page the customer gets") |
| Camera permission denied | "Use sample photos" |
| AI slow / 429 | hybrid mode falls back to fixtures automatically; never reload mid-call |
| Bad highlight boxes | "hide highlights" toggle; observations carry it |
| Everything down | restart API with `MOLDFLOW_DEMO_MODE=fixture` |

Reset between runs: dashboard -> "Reset demo" (or `POST /admin/reset`) and open `/?reset=1` on the phone.
