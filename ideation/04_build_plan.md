# Build Plan: "Bruce", Mold Busters' AI Inspector
Builder: Devin (solo). Time: 1-2 days. Format: live demo.

## One-line pitch
No app, any country, report in minutes, and every scan turns into revenue.

## Demo script (4 min); everything is built backwards from this
1. **Before** (20s): one slide showing the real Job 1/2 journey: app install -> live call -> report hours later -> 4 canned SMS -> $4,779 lost.
2. **Scan** (90s): Michael opens a link on his phone. Bruce guides the camera and asks the missing-context questions. Boxes appear on suspected areas. He gets a severity bucket, a recommended service (virtual / on-site / IAQ) and an estimate range.
3. **Report** (40s): report ready in ~2 min with photo citations -> blurred preview -> $25 unlock (test mode) -> inspector approves it in one click in the console.
4. **Closer** (60s): time-machine slider over Job 1's real Oct 7-22 timeline. Left: the canned SMS. Right: Bruce's concern-aware messages with the "why" trace, the Dec 6 expiry alert and a tenant letter for Job 2.
5. **Scale** (30s): demand map ("where your next $1M is"; simulated, labelled) + proof page (Gemini vs inspector on 24 photos, AI cost per job).

## Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, run with bun
- Gemini API (`@google/genai`): 2.5 Flash for vision, bounding boxes, report/agent; Gemini Live for the voice stretch
- Store: local JSON/SQLite; both sample jobs loaded on boot
- Payments: Stripe Checkout in test mode if a key is available, otherwise a mock checkout (labelled)
- HTTPS for phone camera: deploy to Vercel, or a cloudflared tunnel to the laptop
- Map: react-leaflet with seeded points

## Screens
| Route | Who | Purpose |
|---|---|---|
| `/scan` | Customer (mobile) | Guided camera capture + Bruce chat/voice |
| `/report/[id]` | Customer | Paywalled report, photo citations, "ask your report" Q&A |
| `/console` | Staff | Activity feed, approve/edit, why-trace, review queue, $ at risk |
| `/console/time-machine` | Staff/demo | Replay Job 1/2 timelines: before vs Bruce |
| `/console/rules` | Staff | Plain-English rules -> trigger cards; guardrails panel; pricing table |
| `/map` | Owner | Demand map + partner-lead panel |
| `/proof` | Judges | Gemini vs inspector accuracy table, measured vs projected, AI cost |

## Core logic
- **Job record**: one schema shaped like `job_timeline.json` (concern, people, timeline events, findings, estimate, status). Every skill reads and writes it.
- **Guided capture**: a state machine of Bruce's questions (location, above/below, access, moisture source, odor, health, owner/tenant, paper for scale). The questions adapt based on what Gemini sees.
- **Vision**: per capture, Gemini returns JSON: `{observations[], boxes[], severity_bucket, confidence, follow_up_question}`. The prompt forbids diagnosis and says "possibly fungal, cannot confirm without sampling".
- **Routing**: rules -> virtual ($100) / on-site ($195+HST) / IAQ ($520+tax), using documented prices only.
- **Estimate range**: a configurable rules table (areas x size bucket x containment x clearance + provincial tax 13% / 14.975%), seeded from EST-CASE01's structure and labelled "illustrative; MB configures". It always gives a range, never a quote.
- **Report**: generated in the MB report structure. Every finding cites a capture. Reference PDFs are never used as input.
- **Closer**: a trigger engine on a simulated clock (estimate viewed + 48h silence, expiry approaching, tenant flag, payment gate). The agent drafts from job memory only, with an approve/auto toggle and a why-trace on each action.
- **Guardrails**: no diagnosis, documented prices only, health questions -> doctor/IAQ, discounts capped at 10%, tenant letters cite findings only + "not legal advice".
- **Conflict flags on ingest**: Oct 1 vs Sept 5 booking, Staff A booker+inspector.

## Phases (time-boxed, each ends with a working demo checkpoint)
| # | Phase | Est. | Checkpoint |
|---|---|---|---|
| 0 | Scaffold, data ingest, conflict flags, Gemini key check, **Gemini Live spike (1h max)** | 2h | Console lists both jobs with flags; Live go/no-go decided |
| 1 | Scan flow: camera, guided questions, Gemini boxes, severity, routing, estimate range | 5h | Scanning a dataset photo on a phone gives boxes + route + range |
| 2 | Report + paywall + inspector review queue | 3h | Scan -> report -> $25 unlock -> approve |
| 3 | Closer: trigger engine, time machine, drafts, why-trace, tenant letter, guardrails | 4h | Job 1 replay shows before vs Bruce side by side |
| 4 | Demand map (seeded) + proof page (Gemini over 24 photos vs findings) + cost meter | 2.5h | Map + accuracy table render from real outputs |
| 5 | Stretch: Gemini Live voice, plain-English rules, French toggle, report Q&A | 3h | Each feature is independent and safe to drop |
| 6 | Demo hardening: cached demo mode (offline replay of Gemini responses), HTTPS deploy, slides, rehearsal | 2h | Full demo runs with wifi off |
| | **Total** | **~21h** | |

## Cut order if behind schedule
Cut French -> plain-English rules -> report Q&A -> Gemini Live (text+TTS fallback) -> Stripe (mock checkout). Never cut: scan flow, report, time machine, cached demo mode.

## Honesty labels shown in the app
- Measured: Gemini latency/cost per scan, accuracy vs inspector on 24 photos, report generation time.
- Projected: conversion lift, staff hours saved (82-min wall-clock window != labour).
- Simulated: CRM/SMS/Calendar connectors, demand data, partner marketplace.

## Needed from the user
1. `GEMINI_API_KEY` in the environment (required).
2. Optional: Stripe test key; a Vercel account (or OK to use a tunnel).
3. From Michael: is the virtual inspection now free (Job 2 paid $100)? Is an AI-only pre-assessment OK outside Canada?

## Known data facts
- Walkthrough video is 288x640, 2m56s (very low-res) -> use the stills for vision; the video is only for the time-machine/backdrop.
