# 7. Architecture: how it works, and why each piece exists

## The big picture
```
 Customer (phone browser, no app)            Staff (laptop)                       Outside world
 ─────────────────────────────────           ───────────────────────────────      ─────────────────────────
 /assess  upload flow ─┐                     /hub  /people  /outreach  /alerts    Environment Canada alerts (live, free)
 /assess/live  Bruce ──┤  (ElevenLabs voice)  /cases/*/inspect  /review            OpenRouter (free vision + text models)
 /assess/book ─────────┤                     /schedule /research /settings        ElevenLabs (Bruce voice)
                       ▼                                 ▼                         Twilio / Resend (seam ready, simulated)
              Next.js 16 (App Router, TypeScript, Tailwind) → /api proxy
                                         ▼
              FastAPI (Python 3.12, Pydantic v2)
              ├── Evidence Passport: one Case per job        (cases table, JSON + per-case lock)
              ├── Hub: Contact, ProfileFact, Interaction,     (own tables, indexed columns + JSON, one write lock)
              │        Message, Moment, AlertEvent, Task, Audit
              ├── agents/   every AI call: llm.structured() → Pydantic output, retries, cache, fixtures, rule fallback
              ├── engine/   plain code: pricing, rules, checks, live (Bruce checklist), consent, moments, floods, geo, booking
              ├── messaging.py   THE only way a message leaves: consent.check() → footer → outbox
              └── clock.py       one clock (time-travel for demos)
```

## Why each part exists
| Part | What it does | Why |
|---|---|---|
| **Evidence Passport** (`models/passport.py`) | One typed case record for all six stages | Fragmentation is the problem; every stage cites earlier evidence |
| **Hub models** (`models/crm.py`) | People, facts with quotes, a timeline across tools, messages, moments, alerts | Cases end; relationships don't. Rules live in the types (e.g. health facts can't be used in messages) |
| **`llm.structured()`** (`agents/llm.py`) | The only AI entry point: schema prompt → JSON → Pydantic validation → up to 2 repairs → model fallback → exact cache → fixtures; usage logged; quota circuit breaker | Free models are flaky; the demo must never hang; every output is typed and checkable |
| **Rule-based fallbacks** (`agents/hub.py`) | Templates and patterns for triage, drafting, fact extraction and talking points | Works with no AI (quota, outage, offline demo), and the UI labels it "Template" |
| **Deterministic engines** (`engine/*`) | Pricing and tax, routing, scope/maths/conflict checks, Bruce's checklist and answer validation, CASL consent, moments, flood matching, geography | Anything that must never be wrong is code with unit tests, not a prompt |
| **`messaging.send()`** | Consent check → booking link → footer → simulated delivery → timeline + audit | One choke point: no code path (AI or staff) can skip the rules. Twilio/Resend plug into `_deliver()` |
| **`clock.py`** | `today()` / `now()` with time travel | Moments, consent windows and quiet hours must agree during a demo jump |
| **Geography** (`engine/geo.py` + `data/forecast_zones.json`) | Postal area (FSA) → coordinates; point-in-polygon including MultiPolygons and holes; real Environment Canada forecast-zone outlines | Alert matching works offline and is verified (38/38 postal areas land in the right zone) |
| **Mould reference** (`data/mold_kb.py`) | A reviewed, cited library (Health Canada, EPA, WHO) | Lab results get explained without guessing; never from photos |
| **Bruce** (`scripts/setup_elevenlabs_agent.py`, `engine/live.py`, `web/.../live/client.tsx`) | Voice agent config, a deterministic checklist (`next_step`), on-device dark/shaky checks, steady-frame capture | Voice is fragile, so the rules live in code and the upload flow is always the fallback |
| **Exports** (`exports/`) | Report PDF in Mold Busters' structure; FreshBooks-shaped estimate CSV | Fits the existing stack today, without API access |

## Data flow: the hub hero loop
1. `POST /webhooks/inbound` (shaped like Twilio's) → match the phone or create a contact (inquiry consent, 6 months) → `triage` (AI or rule) → the health question gets the fixed reply → auto-sent (reviewed template) → `extract_facts` (grounded) → health fact pending.
2. `POST /people/{id}/chase` → open estimate + case findings → moisture sources → `draft` → message **locked** (has $) → staff approve → `send()` → consent ok → footer → `sent_simulated`.
3. Inbound "ok let's do it, expecting a baby in March" → intent `estimate_yes` → estimate accepted, crew task, $ recovered → fact "Expecting a baby in March" (pending) → approve → moments recomputed → nursery moment (human-only).
4. `POST /alerts/simulate {zone}` → real zone outline → match contacts by FSA → `POST /alerts/{id}/draft` → offer vs safety-only per consent, in each customer's language → batch approve.

## Stack and tools
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLite, ReportLab, `uv`.
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, npm; types generated from the API's OpenAPI schema (`npm run gen:types`).
- **AI:** OpenRouter (`nvidia/nemotron-3.5-super-vl:free`, reasoning off; nano-omni fallback); ElevenLabs agent for Bruce.
- **Tests:** pytest (80), `scripts/demo_api_run.py` (the whole demo through the API, also offline), Playwright (19; the walkthrough video as a fake camera, ElevenLabs mocked, API in stub mode).
- **Evals:** `scripts/eval_photos.py`, `eval_frames.py`, `simulate_call.py`, `camera_thresholds.py`.

## Running it
See `moldflow/README.md` (run, verify, demo runbook) and `AGENTS.md` (rules for changing the code).
