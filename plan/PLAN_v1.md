# MoldFlow — Build Plan v1 (draft for red-team review)

## 0. Summary
**Product:** MoldFlow, one continuous AI workflow that carries a Mold Busters (MB) case from first concern to verified quote and booking.
**Core concept:** the **Evidence Passport**, a single case record (Pydantic v2) that every stage reads and writes.
**Builder:** one AI coding agent (Devin), solo. **Time:** 1-2 days (~21 focused hours). **Format:** live demo to judge Michael (non-technical, AI fan) + co-judges.
**Rubric:** Useful 10 / Working 10 / Practical 10; must show one before/after; be clear about what works vs is simulated. Ties go to Useful.

**Pitch:** "MB handles a customer across disconnected steps (intake, inspection, measurements, report, estimate, follow-up) spread over ~7 tools. MoldFlow turns them into one continuous case. AI gathers the right evidence, qualified inspectors supply the real diagnostic results, the system drafts and validates the report and estimate, and the customer gets a clear next step."

## 1. Grounding facts (from the sample pack; verified)
- Job 1 (ON house, homeowner): concern = basement, ERMI 13.2, "how big / where from". Basement: small discoloration under sink, swab positive, no thermal anomalies, humidity normal. Upstairs washrooms: grout/silicone discoloration, standing water, failed ball-slope test, leaking tub faucet with elevated moisture. Thermal anomalies top floor / living room below roof / laundry ceiling. Attic: disturbed insulation + discoloration. Exterior: poor drainage, depression at entrance.
- Job 1 estimate EST-CASE01: $3,700 + 13% HST = $4,181; 1 day; **two washrooms + attic** (basement NOT in scope); containment, HEPA, 2-step treatment, fogging, clearance 3 swabs + certificate; 40% deposit; valid 60 days; reconstruction excluded.
- Job 1 turnaround: inspection Oct 6 11:30 -> report email Oct 8 09:05 = **45h35m elapsed** (not labour). Report drafting window Oct 7 12:42-14:04 (82 min wall-clock, 2 admins).
- Job 1 follow-up: 4 canned Close SMS (Oct 9/12/14/19) + manual Dialpad SMS Oct 22 -> closed; estimate viewed, not accepted.
- Job 1 record conflicts: calendar entry created Oct 1, note says booked Sept 5; Staff A listed as booker AND inspector; Staff B as estimator.
- Job 2 (QC apartment, tenant): self-booked; concern = black/white mold in washer, around washer/dryer, vents, oven, persistent smell; health issues reported. 19-min video call, 3 snapshots. Report: discoloration "might resemble something fungal; without physical sampling and laboratory analysis cannot confirm". Recommend doctor, IAQ test, limit time in area. Estimate EST-CASE02 IAQ $520 + 14.975% = $597.87; viewed, not accepted. Then 6 generic "MB Marketplace" emails.
- Job 2 record conflict: report address reads "Sample Property 02, Quebec, ON" (province mismatch).
- Prices documented: on-site inspection $195+HST; virtual $100 incl. tax; IAQ $520+tax; remediation example $3,700+HST; 10% discount offered in SMS.
- Swabs are "non-speciating" (report wording) -> never infer species.
- Video: 288x640, 2m56s, too low-res for vision -> use stills.
- Michael (call transcript): customers find MB via Google/ChatGPT; email photos lack context (location, access, above/below); the app install + phone registration is friction; report takes "a couple hours"; wants a browser-based AI that asks questions and produces report+estimate fast; interested in paid reports ($25), global reach, local partners.

## 2. Scope
### In scope (demo-grade, working)
1. Evidence Passport model + persistence; both sample cases seeded.
2. Customer intake web page (mobile): adaptive questions + guided photo capture/upload + AI photo analysis with boxes + next-step recommendation.
3. Inspector screen: room -> observation -> reading/test -> photo; dictated/typed notes -> AI fills structured findings (inspector confirms).
4. Report + estimate draft: evidence-linked findings, deterministic pricing engine, 3 validation checks (completeness, scope consistency, estimate consistency), human approval.
5. Ops/sales dashboard: pipeline by stage, flags, approvals, follow-up drafts (AI, stage-aware), time-machine before/after for Job 1.
6. Proof page: AI vs inspector on the 24 photos; measured latency + AI cost; measured vs projected vs simulated.
7. Offline demo mode (cached AI responses) + HTTPS tunnel for phone camera.

### Out of scope (roadmap slides only)
Live video streaming, AI avatar/voice, real CRM/SMS/Calendar/FreshBooks integrations, lab integrations, payments/paywall, demand map, partner marketplace, ChatGPT app, custom-trained detectors, multi-tenant auth.

## 3. Stack
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui; package manager **npm**. Browser `<input type="file" accept="image/*" capture="environment">` + getUserMedia preview.
- **Backend:** Python 3.12 + FastAPI + **Pydantic v2** + uvicorn; package manager **uv**.
- **AI:** OpenRouter via `openai` Python SDK (base_url https://openrouter.ai/api/v1). Primary `nvidia/nemotron-3.5-super-vl:free`; fallback `openrouter/free`; optional paid upgrade `google/gemini-2.5-flash`.
- **Storage:** SQLite (single table `cases(id TEXT PK, data JSON, updated_at)`), photos on local disk `data/photos/{case_id}/`.
- **Type sync:** FastAPI OpenAPI -> `openapi-typescript` -> `web/src/lib/api-types.ts`.
- **Tunnel:** cloudflared quick tunnel for phone HTTPS.
- **Repo layout:**
```
moldflow/
  api/            # FastAPI
    app/
      main.py
      models/      # Pydantic: passport.py, agents.py
      agents/      # llm.py (wrapper), photo.py, intake.py, routing.py, dictation.py, report.py, validate.py, followup.py
      engine/      # pricing.py, rules.py, checks.py (deterministic)
      store.py     # SQLite repo
      seed/        # job1.py, job2.py (hand-authored passports from sample pack)
      cache/       # demo-mode cached LLM responses (json keyed by hash)
    tests/
  web/            # Next.js
    src/app/
      intake/[caseId]/page.tsx
      cases/[caseId]/inspect/page.tsx
      cases/[caseId]/report/page.tsx
      dashboard/page.tsx
      dashboard/time-machine/page.tsx
      proof/page.tsx
  data/            # sqlite + photos (gitignored except seeds)
  scripts/         # eval_photos.py, warm_cache.py
```

## 4. Evidence Passport (Pydantic v2)
```python
Stage = Literal["intake","triaged","inspection_scheduled","inspected","report_draft","report_approved","quoted","won","lost"]
Service = Literal["self_help","virtual","onsite","iaq","remediation","referral"]

class Region(BaseModel): label: str; box_2d: conlist(int,4,4); concern: Literal["low","medium","high"]
class Photo(BaseModel): id; path; room: str|None; source: Literal["customer","inspector","video_frame"]; prompt_id: str|None; caption: str|None; ai: PhotoAnalysis|None
class Reading(BaseModel): kind: Literal["temp_rh_dew","moisture","thermal","swab","air_sample","ball_slope","visual"]; value: str|None; unit: str|None; location: str; photo_ids: list[str]; recorded_by: str|None; recorded_at: datetime|None
class Finding(BaseModel): id; room; observation; readings: list[Reading]; evidence_photo_ids: list[str] (min 1); interpretation: str|None; confirmed_by_inspector: bool=False; ai_generated: bool
class LineItem(BaseModel): code; description; qty: Decimal; unit_price: Decimal; area: str|None
class Estimate(BaseModel): id; service: Service; areas: list[str]; line_items; subtotal; tax_rate; tax; total; deposit_pct; valid_days; issued_at; terms: list[str]; status: Literal["draft","approved","sent","viewed","accepted","declined","expired"]
class Flag(BaseModel): id; check: Literal["completeness","scope","estimate","record_conflict","guardrail"]; severity: Literal["info","warn","block"]; message; refs: list[str]; resolved: bool=False; resolution_note: str|None
class Event(BaseModel): at: datetime|None; at_text: str; step; system; what; source: Literal["sample_pack","moldflow","simulated"]
class FollowUp(BaseModel): id; channel: Literal["sms","email"]; body; reason; cites: list[str]; status: Literal["draft","approved","sent_simulated"]; scheduled_for: datetime|None
class Case(BaseModel):
  id; created_at; stage: Stage; customer: {type: homeowner|tenant|landlord|unknown, name_alias, contact_simulated}
  property: {province: ON|QC|other, type: house|apartment|condo|other, region_text}
  concern: str; intake_answers: dict[str,str]; unknowns: list[str]
  photos; findings; recommended_service: Service|None; routing_reasons: list[str]
  estimate: Estimate|None; report: ReportDraft|None; flags; followups; timeline: list[Event]
  ai_usage: list[{agent, model, latency_ms, tokens_in, tokens_out, cost_usd, cached: bool}]
```
Validation in-model: Finding requires >=1 evidence photo; Estimate totals recomputed in a `model_validator` and must equal stored values; Region coords 0-1000 and ymin<ymax, xmin<xmax.

## 5. Agent layer (Pydantic v2 everywhere)
**Wrapper `llm.structured(output_model, messages, images=[], agent="name") -> output_model`:**
1. Build system prompt = role + guardrails + `output_model.model_json_schema()` + "Return ONLY JSON".
2. Call primary model; `response_format={"type":"json_object"}` when supported.
3. Extract JSON (strip fences), `output_model.model_validate_json()`.
4. On `ValidationError` -> one repair retry with the error text. On HTTP 429/5xx/timeout (25s) -> fallback model. Still failing -> raise `AgentFailure` -> UI shows "needs human" state.
5. Demo mode: key = sha256(agent + model + messages + image hashes) -> read/write `cache/`.
6. Log usage to `case.ai_usage`.

**Agents & output models:**
| Agent | Input | Output model | Guardrails |
|---|---|---|---|
| photo | image + room + prompt | `PhotoAnalysis{image_type, observations[], regions[], visible_moisture: bool|None, scale_reference_visible, follow_up_question, confidence}` | no diagnosis; "possibly fungal, cannot confirm without sampling"; thermal = clue not proof |
| intake | case state + last answer | `IntakeTurn{extracted: dict, next_question: str|None, photo_request: PhotoPrompt|None, ready_to_route: bool}` | max ~8 questions; health -> doctor/IAQ language only |
| routing | case | `Routing{service, reasons[], unknowns[], escalate_to_human: bool}` + **rule overrides in code** (health symptoms+odor no visible -> iaq; out of area -> referral; etc.) | never "you don't need an inspection" |
| dictation | inspector text + room | `list[Finding]` (ai_generated=True, unconfirmed) | only facts stated; no invented values |
| report | case (findings, readings, photos; NEVER reference PDFs) | `ReportDraft{summary, sections[{room, findings[{text, cites[]}]}], recommendations[{text, cites[]}], limitations[]}` | every claim cites; post-check rejects uncited claims |
| validate (LLM part) | case + estimate | `list[Flag]` for semantic scope mismatches | complements deterministic checks |
| followup | case + stage + days since + unanswered concerns | `FollowUpDraft{channel, body, reason, cites[], needs_approval: True}` | documented prices/discounts only; no new offers; health -> doctor/IAQ |

## 6. Deterministic engines
- **Pricing (`engine/pricing.py`)**: config table (YAML) of line-item codes: inspection_onsite 195, virtual 100 (tax-incl), iaq_onsite 520, remediation components (containment per area, HEPA+manual clean per area, 2-step treatment per area, fogging per zone, clearance swabs x3 + certificate). Remediation unit prices are **illustrative, calibrated so Job 1 scope (2 washrooms + attic, 1 day) reproduces $3,700**; labelled "MB to configure". Tax: ON 13% HST, QC 14.975% (GST 5% + QST 9.975%). Deposit 40%, validity 60 days. Range for pre-screen = min/max over severity bucket x area count.
- **Rules (`engine/rules.py`)**: routing overrides; stage transitions; follow-up triggers (estimate viewed + 48h no reply; expiry in <=14 days; tenant -> landlord letter option; payment-gate explanation).
- **Checks (`engine/checks.py`)**:
  - Completeness: each room with a finding has >=1 photo; each recommendation cites a finding; required intake fields present; missing readings listed as "not recorded" (info, not block).
  - Scope consistency: set(rooms with positive/elevated evidence) vs set(estimate areas) -> flag differences (Job 1: basement swab positive but basement not in scope -> WARN "confirm intentional exclusion"). Also concern-room vs scope.
  - Estimate consistency: recompute subtotal/tax/total; tax rate matches province; deposit/validity terms present; expiry date computed.
  - Record conflicts (seed-time): Oct 1 vs Sept 5; Staff A dual role; "Quebec, ON".

## 7. API (FastAPI)
```
POST /cases                         -> create intake case
GET  /cases, GET /cases/{id}
POST /cases/{id}/intake/answer      {answer} -> IntakeTurn
POST /cases/{id}/photos             multipart(file, room, prompt_id, source) -> Photo (+ analysis)
POST /cases/{id}/route              -> Routing
POST /cases/{id}/findings/dictate   {room, text} -> list[Finding]
PATCH /cases/{id}/findings/{fid}    confirm/edit
POST /cases/{id}/readings           Reading
POST /cases/{id}/report/draft       -> ReportDraft (+ flags)
POST /cases/{id}/estimate/draft     {areas, options} -> Estimate (+ flags)
POST /cases/{id}/approve            {what: report|estimate}
POST /cases/{id}/flags/{fid}/resolve
POST /cases/{id}/followups/draft    -> FollowUp
POST /cases/{id}/followups/{id}/approve -> sent_simulated
GET  /timemachine/{id}?at=ISO       -> {before_events, moldflow_events, triggers_fired}
GET  /proof                         -> eval table + usage stats
GET  /photos/{case}/{file}
POST /admin/reset                   -> reseed
```

## 8. Screens
1. **/intake/[caseId] (mobile)**: chat-style card stack; one question at a time; "Show me" photo prompts (wide shot, close-up, above/ceiling, below/floor, nearby plumbing/vent, paper for scale); thumbnails with AI boxes overlay; final "What happens next" card: recommended service + reasons + unknowns + range (only for documented services; remediation range only after inspection) + "Book" (simulated).
2. **/cases/[id]/inspect (tablet/laptop)**: rooms list; per room: photos, readings form (kind/value/location), dictation box -> AI findings appear as unconfirmed chips -> inspector confirms/edits.
3. **/cases/[id]/report**: left = draft report with citation chips (hover shows photo); right = Flags panel (completeness/scope/estimate) with resolve notes; estimate table with line items, tax, deposit, expiry; Approve buttons (blocked while `block` flags open).
4. **/dashboard**: Kanban by stage; counts; $ in pipeline / at risk; flags needing attention; follow-up drafts awaiting approval with "why" + cites.
5. **/dashboard/time-machine**: Job 1 timeline slider Oct 6 -> Oct 22; left "what happened" (real events), right "MoldFlow" (report ready same day after approval, flags, stage-aware follow-ups); counters: turnaround, touches, unanswered concerns.
6. **/proof**: per photo: inspector label (from filename/report) vs AI observations; agree/overclaim/miss; latency, cost, model; "measured vs projected vs simulated" legend.

## 9. Demo script (5 min)
1. (30s) Before: MB's journey today (app install, live call, 45h35m to report, 4 canned SMS, 2/2 estimates lost = $4,779).
2. (90s) Live intake on Michael's phone via tunnel URL/QR: tenant-style scenario using Job 2 photos (or his own surroundings); adaptive questions; AI boxes; recommendation "IAQ assessment" with reasons + unknowns.
3. (90s) Job 1 passport: inspector dictates one note -> structured finding; generate report -> citation chips; Flags: "basement swab positive but not in estimate scope" + "Staff A dual role" + estimate math verified ($4,181); inspector resolves + approves.
4. (60s) Time machine: canned SMS vs MoldFlow stage-aware follow-up answering "where is it coming from?"; expiry Dec 6 alert.
5. (30s) Proof + honesty: measured vs simulated; roadmap (paid reports, partners, ChatGPT presence).

## 10. Phases & acceptance criteria
| # | Phase | Est | Acceptance |
|---|---|---|---|
| 0 | Scaffold api/web, npm/uv, env, OpenRouter wrapper w/ Pydantic + fallback + cache, health check | 2h | `pytest` passes wrapper tests with mocked LLM; one live call validates PhotoAnalysis |
| 1 | Passport models + SQLite store + seed Job1/Job2 + record-conflict flags + dashboard list | 2.5h | Dashboard shows 2 cases with correct stages and 3 conflict flags |
| 2 | Intake: questions, photo prompts, upload/capture, photo agent + boxes, routing | 5h | On phone via tunnel: new case -> photos -> boxes -> recommendation in < 60s total AI wait |
| 3 | Inspector: readings form, dictation -> findings, confirm | 2.5h | Dictating Job 1 faucet note yields correct Finding with cited photo |
| 4 | Report + pricing + checks + approval | 4h | Job 1: total $4,181, scope flag fires, uncited claims rejected; approval blocked until block-flags resolved |
| 5 | Follow-up agent + time machine | 3h | Slider shows real vs MoldFlow; drafted SMS references ERMI/source and cites findings |
| 6 | Proof page (eval script over 24 photos) + demo cache warm + tunnel + rehearsal | 2h | Full demo runs with network disabled (cache) in < 5 min |
| | Total | ~21h | |

## 11. Testing
- pytest: pricing (Job 1 $4,181, Job 2 $597.87), tax by province, checks (scope flag on Job 1), model validators, wrapper repair/fallback with mocked responses.
- Playwright smoke (optional): intake happy path, report approve.
- Manual: phone camera via tunnel on iOS Safari + Android Chrome.

## 12. Risks
| Risk | Mitigation |
|---|---|
| Free model rate limits / outage on stage | demo cache; fallback model; optional $10 credit for Gemini Flash |
| Free model bad JSON | Pydantic validate + repair retry + fallback |
| Hallucinated findings/prices | citation-required models; deterministic pricing; reference PDFs never in prompts |
| Liability (diagnosis/health) | prompt + code guardrails; fixed phrasing; human approval |
| Phone camera needs HTTPS | cloudflared tunnel; file input fallback |
| Scope creep | cut list |

## 13. Cut list (in order)
Proof page polish -> time machine animation (static compare instead) -> dictation (typed form only) -> LLM semantic validation (deterministic only) -> getUserMedia preview (file input only). Never cut: passport, intake w/ photo analysis, report+checks+pricing, cache.

## 14. Honesty labels
Measured: AI latency/cost, AI-vs-inspector agreement on 24 photos (illustrative, n=24, not a benchmark). Projected: turnaround reduction, staff time, conversion. Simulated: SMS/email sending, booking, CRM/FreshBooks/Calendar sync, customer identities.
