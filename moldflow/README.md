# MoldFlow: from first concern to verified quote

One continuous AI workflow for Mold Busters, built around an **Evidence Passport**: a single case record
(Pydantic v2) that the customer pre-assessment, inspector, report/estimate review and follow-up all read and write.
Plan and red-team history: [`../plan/PLAN.md`](../plan/PLAN.md), [`../plan/REDTEAM_LOG.md`](../plan/REDTEAM_LOG.md).

## Run it
```bash
# one-time
cd api && uv sync && cd ../web && npm install && cd ..
echo "OPENROUTER_API_KEY=sk-or-..." > api/.env.local      # gitignored
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

## Verify
```bash
cd api && uv run pytest -q                          # 21 unit tests (pricing, checks, routing, guardrails)
uv run python ../scripts/demo_api_run.py            # whole demo path via the API; must pass before each rehearsal
uv run python ../scripts/eval_photos.py             # proof page: AI vs organizer captions on all 24 photos (~90 s)
cd ../web && npx tsc --noEmit && npx eslint src && npx next build
```
Offline check: run the API with `MOLDFLOW_DEMO_MODE=fixture OPENROUTER_API_KEY=x`; `demo_api_run.py` must still pass (fixtures in `api/cache/fixtures`).

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
