# MoldFlow — Build Plan v2 (post red-team)

> v1 was attacked by 4 hostile reviewers (Judge/Rubric, Solo Build Feasibility, Honesty/Data/Liability, Users/UX/Demo). Every accepted attack is folded in; rejected ones are listed in §17. Changes from v1 are marked **[RT]** with the attacking reviewer: J, B, H, U.

## 0. Summary
**Product:** MoldFlow, one continuous AI workflow from a customer's first concern to a verified quote and booking.
**Core:** the **Evidence Passport**, one Pydantic v2 case record that every stage reads and writes.
**Builder:** Devin (solo AI agent). **Time:** ~22 focused hours + 2h buffer over 1-2 days. **Format:** live demo, target **4:15** plus Q&A.
**Rubric:** Useful 10 / Working 10 / Practical 10; one before/after; clear labels for measured, projected and simulated. Ties go to Useful.

**One-sentence before/after [RT-J]:** "Today a customer emails photos at 11 pm, the report arrives 45 hours after the inspection, they get four generic texts, and a $4,181 estimate sits unaccepted. With MoldFlow: guided pre-assessment in 3 minutes, an approved, evidence-linked report and quote the same day, and follow-up that answers their actual question."

**Pitch:** "MB handles a customer across disconnected steps spread over ~7 tools. MoldFlow turns them into one continuous case. AI gathers the right evidence, qualified inspectors supply the real diagnostic results, the system drafts and validates the report and estimate, and the customer gets a clear next step. It never diagnoses mold; humans approve everything that leaves the building."

## 1. Grounding facts (all verified against the pack)
| Fact | Source |
|---|---|
| Job 1 ON house, homeowner; concern basement, ERMI 13.2, "how big / where from" | job_timeline.json |
| Basement: small discoloration under sink, swab positive, no thermal anomalies, humidity within standard | timeline + report p. findings |
| Washrooms: grout/silicone discoloration, standing water, **ball-slope failed**, tub faucet leak with **elevated moisture**; thermal anomalies top floor / living room / laundry; attic disturbed insulation + discoloration; exterior drainage + depression | timeline + report |
| EST-CASE01 $3,700 + 13% HST = $4,181; 1 day; **2 washrooms + attic (basement not in scope)**; 40% deposit; valid 60 days; reconstruction excluded | timeline |
| Inspection Oct 6 11:30 -> report email Oct 8 09:05 = **45h35m elapsed (not labour)**; write/review window Oct 7 12:42-14:04 (82 min, writer + reviewer) | timeline |
| 4 canned Close SMS (Oct 9/12/14/19) + manual Dialpad SMS Oct 22; estimate "viewed, not accepted yet", lead "Potential" | timeline |
| Conflicts: calendar created Oct 1 vs note "booked Sept 5"; Staff A booker + inspector; Staff B estimator | timeline |
| Job 2 QC apartment, tenant, self-booked; washer/vents/oven + persistent smell; health issues reported (in findings) | timeline |
| Report wording: "might resemble something fungal ... without physical sampling and laboratory analysis" cannot confirm | Report_Virtual_Sample.pdf (pdftotext) |
| Report address line "Sample Property 02, Quebec, ON" (province mismatch) | Report_Virtual_Sample.pdf |
| Swabs: "non-speciating diagnostic swab test" | Report_OnSite_Sample.pdf |
| EST-CASE02 IAQ $520 + 14.975% = $597.87; viewed, not accepted | timeline |
| Documented prices: on-site $195+HST; virtual $100 incl. tax; IAQ $520+tax; remediation example $3,700+HST | timeline |
| Video 288x640, 2m56s | ffprobe |
| Michael's stated wants (Google/ChatGPT discovery, emailed photos lack context, app friction, report "couple hours", browser AI, $25 paid reports, global reach) | **pre-hackathon call, not dataset**; cite as such |

**Wording rule [RT-H]:** never say "lost". Say "**both estimates were sent and viewed, $4,779 combined, and neither was accepted.**"

## 2. Scope
### In (demo-grade, working)
1. Evidence Passport models + SQLite store; both cases seeded **from timeline JSON + photo filenames + job story only** (never the reference reports) [RT-H].
2. **Customer pre-assessment** (mobile): photo-first, interleaved chips + adaptive photo prompts (at most 4 questions and 4 photos), narrated wait states, resume, EN/FR toggle, "use sample photos" escape hatch, and a **Pre-Assessment card + PDF as the value moment** [RT-U, J].
3. **Service-area routing incl. global [RT-J]:** in-area -> book a documented service; out-of-area -> "AI Pre-Assessment report" product ($25, mock checkout labelled; Stripe test mode is a stretch) + "partner referral (roadmap)".
4. **Inspector screen:** one note box per room (keyboard mic for dictation) -> AI findings as confirmable chips; quick-tap readings (elevated / normal / not recorded) [RT-U, B].
5. **Report + estimate review:** evidence-cited draft, deterministic pricing (tax/deposit/expiry), 3 checks + record conflicts, **two-role approval (Drafted by MoldFlow / Reviewed by <name>)** [RT-U].
6. **Exports [RT-J]:** report PDF in MB report structure + estimate CSV (FreshBooks-importable shape), so it "drops into the existing stack".
7. **Follow-up:** stage-aware AI drafts citing findings; **no AI-generated offers** (staff-inserted `{offer}` only); batch approve; max 1 draft per case per 48h [RT-H, U].
8. **Before/after compare:** static side-by-side for Job 1 with counters (slider is a stretch) [RT-B].
9. **Proof page:** "AI description vs organizer photo captions (n=24, illustrative, not a benchmark)" + **safety metric: refusal-to-confirm rate** + latency/tokens per call [RT-H].
10. Demo hardening: 2-tier cache (exact + fixture), reset endpoint, runbook, judge Q&A prep [RT-B, U, J].

### Out (roadmap slide)
Live video, AI avatar/voice agent, real CRM/SMS/Calendar/FreshBooks APIs, lab integrations, demand map, partner marketplace, ChatGPT app, trained detectors, auth/multi-tenant, consent and retention system (named as a production requirement).

## 3. Stack
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui, **npm**. Client-side image resize to <=1280px JPEG via canvas (fixes HEIC, EXIF rotation, size) [RT-B].
- **Backend:** Python 3.12 + FastAPI + **Pydantic v2** + uvicorn (`--workers 1`), **uv**.
- **AI:** OpenRouter via the `openai` SDK. Primary `nvidia/nemotron-3.5-super-vl:free` (~9s/photo measured). Fallback 1: `openrouter/free`. Fallback 2: **cache/fixture** (never wait 30s on stage) [RT-B]. Paid switch `google/gemini-2.5-flash` via env **only if the key's $0 credit limit is raised** [RT-B].
  - Limits (verified via `/api/v1/key`): **1,000 free requests/day, 20/min**. The per-minute cap is the constraint, so throttle the eval script.
- **Storage:** SQLite `cases(id PK, schema_version INT, data JSON, updated_at)`; photos on disk.
- **Types:** Pydantic -> FastAPI OpenAPI -> `openapi-typescript` via `npm run gen:types`, run **once at schema freeze (end of Phase 1)** and on deliberate changes only [RT-B].
- **HTTPS:** cloudflared tunnel started in Phase 0 and kept running; QR + short URL on the presenter screen [RT-B, U].
- **Repo layout:**
```
moldflow/
  api/app/{main.py, models/{passport.py,agents.py}, agents/{llm.py,photo.py,intake.py,routing.py,findings.py,report.py,followup.py},
           engine/{pricing.py,pricing.yaml,rules.py,checks.py}, store.py, seed/{builders.py,job1.py,job2.py,photo_map.py},
           cache/{exact/,fixtures/}, i18n/{en.json,fr.json}, exports/{pdf.py,csv.py}}
  api/tests/
  web/src/app/{page.tsx (landing), assess/[caseId]/page.tsx, cases/[caseId]/inspect/page.tsx,
               cases/[caseId]/review/page.tsx, dashboard/page.tsx, compare/page.tsx, proof/page.tsx}
  scripts/{eval_photos.py, warm_cache.py, demo_api_run.py}
  data/ (gitignored: sqlite, uploads)
```

## 4. Evidence Passport (Pydantic v2)
```python
SCHEMA_VERSION = 1
Stage   = Literal["intake","pre_assessed","inspection_booked","inspected","report_draft","report_approved","quoted","accepted","declined","stalled"]
Service = Literal["self_help","virtual","onsite","iaq","remediation","remote_report","referral"]

class Region(BaseModel):          # normalized in a field_validator BEFORE strict checks [RT-B]
    label: str                    # "look closer: ceiling staining"
    box_2d: tuple[int,int,int,int]# ymin,xmin,ymax,xmax 0-1000 (accept xyxy/float/pixel, sort+clamp+rescale)
class PhotoAnalysis(BaseModel):
    image_type: Literal["regular","thermal","test_kit","instrument","other"]
    observations: list[str]       # always rendered as chips (boxes optional)
    regions: list[Region] = []    # malformed regions dropped, not fatal
    visible_moisture: bool | None
    scale_reference_visible: bool
    quality: Literal["ok","too_dark","blurry","not_relevant"]
    follow_up_question: str | None
    declined_to_confirm_mold: bool   # safety metric
class Photo(BaseModel): id; path; room: str|None; source: Literal["customer","inspector"]; prompt_id: str|None; caption_from_pack: str|None; analysis: PhotoAnalysis|None
class Reading(BaseModel): kind: Literal["temp_rh_dew","moisture","thermal","swab","air_sample","ball_slope","visual"]; result: Literal["elevated","normal","positive","negative","failed","passed","anomaly","none","not_recorded"]; value_text: str|None; location: str; photo_ids: list[str]
class Finding(BaseModel): id; room; observation; readings: list[Reading]; evidence_photo_ids: Annotated[list[str], Len(min_length=1)]; source: Literal["inspector_entered","ai_structured"]; confirmed: bool
class LineItem(BaseModel): code; description; qty: Decimal; unit_price: Decimal; illustrative: bool = True
class Estimate(BaseModel): id; service: Service; areas: list[str]; line_items: list[LineItem]; subtotal: Decimal; province; tax_rate: Decimal; tax; total; deposit_pct=40; valid_days=60; issued_on: date; expires_on: date; terms: list[str]; status: Literal["draft","approved","sent","viewed","accepted","declined","expired"]; source: Literal["sample_pack","engine"]
class Flag(BaseModel): id; check: Literal["completeness","scope","estimate","record_conflict","guardrail","offer"]; severity: Literal["info","warn","block"]; message; refs: list[str]; resolved=False; resolution_note: str|None; resolved_by: str|None
class Event(BaseModel): at: datetime|None; at_text: str; step; system; what; source: Literal["sample_pack","moldflow","simulated"]
class FollowUp(BaseModel): id; channel; body; reason; cites: list[str]; offer_token_used: bool=False; status: Literal["draft","approved","sent_simulated"]; scheduled_for: date|None
class Approval(BaseModel): what: Literal["report","estimate","followup"]; drafted_by="MoldFlow"; reviewed_by: str; at: datetime
class Case(BaseModel):
    schema_version: int = SCHEMA_VERSION
    id; created_at; stage: Stage; language: Literal["en","fr"]="en"
    customer: Customer(type: homeowner|tenant|landlord|unknown, alias, contact_simulated)
    property: Property(country, province: ON|QC|other|unknown, in_service_area: bool|None, type)
    concern: str; answers: dict[str,str]; unknowns: list[str]; health_flag: bool=False
    photos; findings; recommended_service: Service|None; routing_reasons: list[str]
    pre_assessment: PreAssessment|None; report: ReportDraft|None; estimate: Estimate|None
    flags; followups; approvals; timeline: list[Event]; ai_usage: list[AIUsage]
```
- Persist with `model_dump(mode="json")` only; Decimal is quantized to 0.01 [RT-B].
- `migrate(blob)` fills defaults for older schema_versions [RT-B].
- A per-case `asyncio.Lock` around load->mutate->save [RT-B].

## 5. Agent layer
**`llm.structured(Model, messages, images, agent, case_id, fixture_key=None) -> Model`**
1. System prompt = role + guardrails + `Model.model_json_schema()` + "Return ONLY JSON". `max_tokens` set explicitly; `response_format=json_object` if accepted, otherwise prompt-only [RT-B].
2. Extract JSON (strip fences / leading text) -> `model_validate_json`. On ValidationError, **up to 2 repair turns** that echo the raw output + the errors.
3. Timeout 20s. On 429/5xx/timeout: fallback 1. If that also fails: fixture (if `fixture_key`) or raise `AgentFailure` -> UI "needs human" state.
4. **Cache tier 1 (exact):** sha256(agent+model+messages+image bytes). **Tier 2 (fixture):** keyed by `fixture_key` (e.g. `photo:job2:dryer_vent`, `intake:demo:step3`) so scripted steps and the sample-photos button replay instantly offline [RT-B]. `DEMO_MODE=fixture|live|hybrid` (hybrid = live with fixture on failure).
5. Photo analyses run **in parallel** (`asyncio.gather`, semaphore 3 to respect 20/min) [RT-B].
6. Every call is logged to `case.ai_usage` (model, latency, tokens, cost_usd, cache tier).

| Agent | Output | Code-level guardrails |
|---|---|---|
| photo | `PhotoAnalysis` | Prompt asks for "areas worth a closer look", never "mold regions"; boxes labelled "look closer" [RT-H]; quality gate -> one retake prompt |
| intake | `IntakeTurn{extracted, next_chip_question?, photo_prompt?, ready}` | Max 4 questions / 4 photos; **health branch is hard-coded in rules.py, not LLM** [RT-H] |
| routing | `Routing{service, reasons, unknowns, escalate}` + rule overrides | Never "no inspection needed"; tenant -> landlord-letter option surfaced; out-of-area -> remote_report |
| findings | `list[Finding]` from an inspector note | Only stated facts; result enums; cites must be existing photo ids |
| report | `ReportDraft{summary, sections[{room, claims[{text, cites}]}], recommendations[{text, cites}], limitations}` | Post-check drops/flags uncited claims; reference PDFs never in context |
| followup | `FollowUpDraft{body, reason, cites, uses_offer_token}` | May reference only estimate no., scope, computed expiry, stated concerns; `%`/"discount" without an approved offer -> `offer` flag [RT-H] |

## 6. Deterministic engines
- **Pricing [RT-H]:** pre-assessment shows **only documented flat prices** (virtual $100 incl., on-site $195+HST, IAQ $520+tax). **No remediation range before inspection.** The remediation estimate for Job 1 is loaded as the **documented total ($3,700)**, with the engine computing tax/total/deposit/expiry. Line-item decomposition is shown only with an "illustrative placeholders, MB configures" watermark. Tax: ON 13%; QC 14.975%; unknown or conflicting province -> **flag, don't guess**.
- **Rules:** health symptoms -> fixed bilingual string + IAQ route; tenant -> landlord letter option ("for the tenant's own use, not legal advice"); out-of-area -> remote report; stage transitions; follow-up triggers (viewed + 48h, expiry <= 14 days, payment-gate explanation), throttled to 1 per 48h.
- **Checks:**
  - Completeness: every finding cites a photo; every recommendation cites a finding; missing readings shown as "not recorded" (info).
  - **Scope (block):** rooms with positive/elevated/failed evidence vs estimate areas. Job 1 -> "Basement swab positive but basement not in estimate scope: confirm intentional exclusion or add."
  - Concern vs scope (warn): "Customer's stated concern (basement) is not in the proposed scope; explain in the report."
  - Estimate (block on math errors): recomputed totals, tax matches province, deposit/validity present, expiry date shown.
  - Record conflicts (warn): Oct 1 vs Sept 5; Staff A dual role; "Quebec, ON".

## 7. API
```
POST /cases                                   GET /cases  GET /cases/{id}
POST /cases/{id}/answers {key,value}          -> IntakeTurn
POST /cases/{id}/photos (multipart, prompt_id, room, fixture_key?) -> Photo(+analysis)
POST /cases/{id}/sample-photos {job:"job2"}   -> injects Job 2 photos (fixture-backed) [RT-U]
POST /cases/{id}/pre-assessment               -> Routing + PreAssessment (+ PDF url)
POST /cases/{id}/findings/from-note {room,text} -> list[Finding]
PATCH /cases/{id}/findings/{fid}              confirm/edit
PUT  /cases/{id}/readings                     quick-tap readings
POST /cases/{id}/report/draft                 -> ReportDraft + flags
POST /cases/{id}/estimate/draft               -> Estimate + flags
POST /cases/{id}/flags/{fid}/resolve {note, by}
POST /cases/{id}/approve {what, reviewed_by}  (409 if block flags are open)
GET  /cases/{id}/export/report.pdf   GET /cases/{id}/export/estimate.csv
POST /cases/{id}/followups/draft  POST /followups/approve-batch {ids, by}
GET  /compare/job1   GET /proof   GET /photos/{case}/{file}
POST /admin/reset    (reseed + clear uploads; <5s)
```

## 8. Screens
1. **Landing `/`:** "Something looks like mold? Let's look together. 3 minutes, no app." EN/FR. Resume banner (localStorage caseId). QR for the presenter.
2. **Pre-assessment `/assess/[id]` (7 steps, <=15 taps, 1 optional text field) [RT-U]:**
   - S1 wide photo (camera **or** library) -> narrated analysis ("Looking at the area...") -> chips + optional "look closer" boxes.
   - S2 chips: room / owner-tenant-landlord / health symptoms (yes -> fixed doctor + IAQ text) / postal code or country.
   - S3 up to 3 adaptive close-ups ("what's directly above it?", "plumbing or vent nearby?", "sheet of paper next to it for scale"); quality gate -> one retake; "skip for now" on every prompt.
   - S4 optional free text (keyboard mic).
   - S5 progress ("Checking photos ✓ / Matching services / Preparing your summary"), 25s cap -> fallback.
   - S6 **Pre-Assessment card**: annotated photos, plain summary, "what photos can't tell us", recommended service + documented price, tenant -> landlord letter, out-of-area -> $25 remote report (mock checkout), download PDF, Book (simulated).
   - Disclaimers + privacy notice persistent (§13). "Use sample photos" button always visible.
3. **Inspect `/cases/[id]/inspect`:** rooms -> photos + quick-tap readings + one note box -> findings chips (confirm/edit). At most 3 taps per room beyond photos.
4. **Review `/cases/[id]/review`:** left: report with citation chips (hover shows photo); right: plain-English flags sorted by severity, each with "Fix" or "Accept with note"; estimate table with watermark; header "Drafted by MoldFlow · Reviewed by [dropdown]"; Approve (blocked by block flags); Export PDF/CSV.
5. **Dashboard `/dashboard`:** **not a Kanban** [RT-U]: an inbox of "needs you" items (approvals, flags, follow-up drafts with batch approve), stage list, "$ sent but not accepted" counter. Framed as "what your Asana card links to".
6. **Compare `/compare`:** Job 1 side by side. Left: real events (labelled sample pack). Right: MoldFlow (labelled simulated workflow on seeded data). Counters: elapsed to report, customer touches, concerns answered (0 vs N), estimate expiry visibility.
7. **Proof `/proof`:** per-photo table (organizer caption | AI observations | declined-to-confirm? | notes), safety metric, latency/tokens, the measured/projected/simulated table verbatim from §13.

Accessibility: 44px tap targets; flags use icon + text (never color only); high contrast; i18n strings for every customer-facing string.

## 9. Demo script (4:15 target) [RT-J]
1. **0:00-0:30 Before.** One slide: the real Job 1/2 timeline + the one-sentence before/after.
2. **0:30-2:00 Customer.** Presenter's own phone (pre-checked) via QR -> photo of a staged spot -> narrated analysis + "look closer" chips -> chips questions -> tenant + Quebec -> recommends IAQ with the reason "health symptoms + odour, photos can't confirm" + **landlord letter** (*why this time it converts*) -> toggle **FR** for one screen. Beat: "Outside our area? It sells a $25 remote report instead." (show the card). Fallback at any hiccup: "use sample photos".
3. **2:00-3:15 Staff, Job 1, one screen flow.** Inspector types/dictates the faucet note -> finding chip confirmed -> Draft report with citation chips -> flags: **scope block** (basement swab positive, not in scope), concern-vs-scope warn, record conflicts, math verified $4,181 -> resolve with note -> Approve as reviewer -> **Export PDF**.
4. **3:15-4:00 Follow-up.** Compare screen: "still interested or should we close your case?" vs MoldFlow's draft answering "where is it coming from?" (cites the failed ball-slope + faucet moisture) + "price holds until Dec 6".
5. **4:00-4:15 Close on the artifact.** Hold up the PDF: "Pre-assessment to approved quote in about 4 minutes, roughly N tokens of AI, one human approval. Real: everything you saw. Simulated: sending, booking, CRM sync." "Questions?"

## 10. Judge Q&A prep [RT-J]
| Q | 10-second answer |
|---|---|
| Does it diagnose mold? | No, by design. It flags areas to look at and gathers evidence; inspectors and lab sampling confirm. That's what makes it safe to deploy. |
| How does it fit our 7 tools? | Exports today (report PDF in your format, FreshBooks-shaped CSV). Next: Close/FreshBooks/Asana APIs; the passport becomes the link on the Asana card. |
| Can the AI be wrong? | Yes. Every claim cites a photo or reading, a human approves, and the proof page shows where it overclaimed. |
| What does it cost? | Free-tier models in the demo; at paid Gemini Flash rates roughly cents per case (shown on the proof page). Remaining human steps: inspector visit, one review, one approval. |
| Quebec? | FR toggle, QC tax, and the province-mismatch flag. Production needs full French (Bill 96). |
| Privacy? | Demo uses de-identified data; production needs consent, retention limits, PIPEDA / Law 25, and a no-training provider. |
| Why not instant remediation prices? | Job 1's customer worried about the basement; the real $3,700 scope was upstairs and the attic, found with instruments. Photos can't price that, so we route to the right paid service instead. |
| Global? | Out-of-area -> $25 remote report; partner network on the roadmap. |
Parking lot: "Great question, that's on our roadmap slide."

## 11. Phases (critical-path order) & definition of done
| # | Phase | Est | DoD |
|---|---|---|---|
| 0 | Scaffold (npm/uv), env, `llm.structured` (repair x2, fallback, 2-tier cache, usage log), tunnel up | 3h | Real Nemotron call -> valid PhotoAnalysis; forced 429 -> fixture; truncated-JSON fixture repaired; tunnel URL loads on phone |
| 1 | Models, store (lock, migrate), **seeds from timeline + filenames + job story**, record-conflict flags, minimal dashboard, **schema freeze + gen:types** | 4h | Both seeds validate; every cite resolves to a file; $4,181 / $597.87 recomputed; 3 conflict flags; dashboard lists both |
| 2 | Pre-assessment flow S1-S6, resize, parallel photo agent, routing + rules, sample-photos button, resume, wait states | 6h | On a real phone via tunnel: photo -> chips (+boxes if valid) -> card with documented price in <=60s live / <=5s fixture; reload keeps state; HEIC is fine |
| 3 | Review: report agent + citation post-check, pricing engine, checks, two-role approval, PDF/CSV export | 5h | Job 1 scope block fires; uncited claim flagged; approve 409 until resolved; PDF + CSV download |
| 4 | Inspect screen: note -> findings chips, quick-tap readings | 1.5h | Faucet note -> Finding citing photo 16, unconfirmed -> confirm |
| 5 | Follow-up agent + offer check + batch approve; compare page (static) | 2h | Draft cites a finding, mentions source + Dec 6 expiry; "%" text without an offer -> flag |
| 6 | Proof page (eval_photos.py throttled to 20/min), FR strings, disclaimers, `demo_api_run.py`, warm fixtures, runbook rehearsals x2 | 3h | Eval over 24 photos completes; full demo passes with wifi off in fixture mode; reset <5s |
| - | **Buffer** | 2h | — |
| | **Total** | **26.5h** | Hard gate at hour 14: if Phase 3 isn't done, freeze features and polish the demo path |

**Stretch (only if ahead):** Stripe test checkout for the $25 report; compare slider; TTS readout of the pre-assessment; Gemini Flash switch.

## 12. Testing
- **pytest unit:** pricing ($4,181; $597.87; QC/ON; conflicting province -> flag), Region normalization (xyxy, floats, pixels, inverted), checks (Job 1 scope block), health branch never calls the LLM, offer check, Decimal round-trip, migrate().
- **`scripts/demo_api_run.py` (integration, most important) [RT-B]:** runs the entire demo as API calls in fixture mode; must pass before every rehearsal.
- **Playwright (one test):** mobile viewport pre-assessment happy path with sample photos.
- **Manual:** iOS Safari + Android Chrome via tunnel (camera, library, HEIC, reload).

## 13. On-screen wording (verbatim) [RT-H]
- **Global banner:** "Prototype: MoldFlow assists qualified inspectors; it does not identify, diagnose, or confirm mold. Nothing here replaces physical sampling and laboratory analysis."
- **Boxed photos:** "Highlighted areas are suggestions for a closer look, not confirmed mold."
- **Pre-assessment card:** "Prices shown are Mold Busters' published service rates. Remediation costs can only be estimated after an inspection."
- **Estimate:** "Line items are illustrative placeholders; Mold Busters sets actual pricing. Totals, tax, deposit and validity follow the documented estimate terms."
- **Follow-up drafts:** "Draft for staff review; not sent. AI may reference the estimate, its expiry and the customer's concerns; it may not create offers."
- **Health (fixed, EN/FR):** "We can't give medical advice; please speak with a doctor. We can arrange a professional Indoor Air Quality test."
- **Privacy:** "Demo: photos are processed by a third-party AI provider. Production use requires consent, retention limits and PIPEDA / Quebec Law 25 compliance."
- **Landlord letter:** "Prepared for the tenant's own use, based on recorded observations. Not legal advice."
- **Proof page:** Measured = latency/tokens per call; AI description vs organizer captions (n=24, illustrative, not an accuracy benchmark); refusal-to-confirm rate. Projected = turnaround (45h35m elapsed; 82-min write/review window, 2 staff), staff touches, conversion. Simulated = sending, booking, CRM sync, customer identities, seeded inspector inputs (from timeline/filenames; reference reports never used as model input).

## 14. Demo-day runbook [RT-U]
**T-60:** `POST /admin/reset` -> verify 2 cases + flags · `warm_cache.py` (fixtures for the demo path + sample photos) · `demo_api_run.py` passes with wifi off · tunnel up, QR on screen, own phone completes the flow once · staged "spot" prop ready · tabs open: landing, review(job1), compare, proof · projector 125% zoom, light theme · faucet note in clipboard.
| Failure | Fallback |
|---|---|
| Tunnel/QR dead | Own phone on hotspot -> else laptop localhost, narrate "same page the customer gets" |
| Camera permission denied | "Use sample photos" |
| AI slow / 429 | Hybrid mode auto-falls to fixture after 20s; never reload |
| Bad boxes | Toggle boxes off; chips carry it; point to the proof page |
| Dictation fails | Paste the note |
| Total crash | Screenshot deck of every screen |
**Reset between runs:** `POST /admin/reset` + `?reset=1` clears localStorage (<60s).

## 15. Risks (residual)
| Risk | Mitigation |
|---|---|
| Free model congestion (20/min, upstream 429s seen on Gemma) | Hybrid mode -> fixtures; semaphore; raise key limit for Gemini Flash if available |
| Loose/hallucinated boxes | Chips-first UI, boxes optional + labelled "look closer" |
| Seeding effort | Builders + explicit photo_map; own phase budget |
| Scope creep | Hour-14 gate; stretch list |
| Liability optics | Fixed wording; health branch in code; no pre-inspection remediation prices; human approval |

## 16. Changes from v1 (summary)
Photo-first interleaved intake with a value-moment card + PDF; global $25 remote-report route; exports (PDF/CSV); two-role approval; inbox instead of Kanban; static compare; documented-price-only pre-assessment; no reverse-engineered pricing; seeds without reference reports; proof page reframed with a safety metric; no AI offers; health branch in code; FR toggle; privacy notice; 2-tier cache + fixtures + sample-photos button; parallel photo calls; Region normalization; repair x2; per-case lock + migrate + mode="json"; integration demo test; Q&A prep; runbook; hours 21 -> 26.5 incl. buffer with an hour-14 gate.

## 17. Attacks considered and not adopted
- "Drop FastAPI, single Next.js app" (B): rejected; the user chose Pydantic v2 for agent calls. Mitigated by schema freeze + one-shot type gen.
- "Real Stripe checkout as core" (J): kept as stretch; needs a Stripe key, and a mock checkout labelled as such scores the same on stage.
- "Use the judge's phone" (U): presenter's own phone by default; offer Michael a turn only if time allows.
