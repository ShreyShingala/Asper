---
agent: devin-local
session: pickle-arch
created: 2026-10-24T17:23:41Z
---
# MoldFlow Hub: the AI back office (v3, after 4 subagent red-team reviews)

One hub where AI runs the front and back office up to and around the inspection (answering, booking, chasing estimates, remembering, reaching out, drafting), with staff approving through an autonomy dial, as "one pane of glass" over the tools they keep.

## v3 decisions from the subagent reviews (these override v2 below where they conflict)
**Owner/value [O]**
- **New hero loop = the rescue:** (1) 11 PM inbound text "found black stuff in the basement, is it dangerous?" -> AI answers instantly (FAQ + health deflection), creates contact + case, offers slots, books -> (2) Job 1's real $4,181 estimate "viewed, not accepted": AI chase that answers the customer's actual question (ERMI 13.2, the source = washroom leak/attic) shown next to the 4 real canned Close texts -> customer replies "ok let's do it - also we're expecting a baby in March" -> deposit link + **$ recovered counter** + pending fact with quote -> nursery moment -> (3) 20-second flourish: rainfall alert over Gatineau, French check-in drafts for opted-in customers.
- `/hub` leads with **money** (open/at-risk estimate $, chased -> replied -> accepted funnel, $ recovered) and **0 missed contacts**; map is a collapsed static SVG.
- Facts feed **drafts and talking points**, not just a profile page; moments reduced to revenue-linked ones (estimate expiry, post-remediation check, storm opt-in) + the fact hooks.
- French: drafts in `contact.language` (default fr for QC postal codes); seed French customers.
- Honest framing: "one pane of glass over your tools": FreshBooks + Google Calendar stay (write-back = roadmap); Close/Asana/Brain sequences replaced. Remediation stage (crew slot task, lab status tracker, clearance letter) = P1.
- `/research` screen cut to a small library; `mold_brief` embedded in report/follow-up when a lab result names a mold.

**Privacy/law [P]** (build-blocking: CEM split, consent basis, consent collection)
- A check-in with a booking link is a commercial electronic message. Two drafts: `safety_only` (no link/offer, OK without marketing consent) and `checkin_offer` (full CASL). `storm_checkin_opt_in` is a preference, never consent.
- `Contact.consent` per channel: basis (express | implied_purchase | implied_inquiry | none), granted_at, implied_until, granted_via, evidence_ref, text_version, opt_out_at. Imports never fabricate consent. `Suppression` table keyed by channel + hash(identifier) survives merges.
- Every message gets, by code: identity block (Mold Busters, address, phone, site), unsubscribe (STOP / ARRÊT / link), and on AI-sent threads "Sent by Mold Busters' automated assistant, reply HUMAN for a person" (EN/FR).
- Health facts: `message_use=never` enforced in the model AND never passed to the drafting LLM. Life-event/children facts usable in messages only with express personalised-reminders consent; nursery moment = human talking point.
- Unchecked consent checkbox + Law 25 s.8.1 profiling notice on the booking form and first SMS (EN/FR wording from the review); recording disclosure flag on call transcripts (extraction blocked without it).
- Simple staff login + roles (office / inspector / owner), profile views audited (P1); `/privacy` page EN/FR; processor list (OpenRouter, ElevenLabs, Twilio, Resend) on settings; retention jobs P1.
- Every outbound, including manual staff replies, goes through `messaging.send()` -> `consent.check()`.

**Engineering [E]**
- `app/clock.py` (`today()/now()`, `MOLDFLOW_TODAY`), replacing `date.today()`/`datetime.now()` call sites; `POST /admin/clock` for time travel.
- `Message` is canonical; existing `/cases/{id}/followups/*` become thin adapters (paths unchanged, tests/e2e stay green).
- `Interaction` stays a separate model; the profile renders a merged timeline (case `Event`s + interactions), so `Event.source` doesn't change.
- `store.py`: generic JSON tables (contacts, facts, interactions, messages, moments, alerts, tasks, audit, settings, suppressions, meta) + one global write lock for multi-entity writes; `/admin/reset` wipes everything; seed guarded.
- Lifespan replaces `on_event`; scheduler off unless `MOLDFLOW_SCHEDULER=1` (never in e2e/pytest); every job has a run-now endpoint.
- `geo.py`: Polygon + MultiPolygon + holes, lon/lat order; FSA centroid dict for ~40 service-area FSAs; unknown FSA = no match. Real EC forecast-zone outlines (City of Ottawa, Gatineau, Metro Montreal-Laval, City of Toronto) saved as fixtures; live alerts cached; fixture mode never fetches.
- Every new agent output model gets an e2e stub and committed fixtures; new endpoints return Pydantic response models (real TS types).
- Routers split with `routers/deps.py`; all existing paths unchanged.
- Realistic effort ~31-37 h. **Gate:** no P1 screen before `demo_api_run.py` proves the hero loop in fixture mode with no API key.

**Staff/adoption [S]**
- Calls: simulated Dialpad import -> "after-call card" (summary, facts, follow-up draft) approved in seconds; no promise of live call answering.
- Conversation ownership `ai | human:<name>`: staff reply or "Take over" pauses AI on that thread; "Hand back to AI".
- Autonomy defaults: auto = booking confirms/reminders, receipts, FAQ answers, internal briefs; draft = triage replies, reports, follow-ups (graduated auto after 30 sends with <10% edits), storm batches; **locked draft** = anything with a $ amount (button shows the amount), anything using personal facts; never AI-sent = health/mold identity; escalations always human. Kill switch in the hub header. Scorecard per action type.
- Global search (phone digits, name, address, case id) in the staff header; talking points above the fold on profiles, written as agent scripts with provenance ("she told Bruce on Oct 24") and freshness.
- `/hub` order: alert banner (only when matches) -> Needs you (counts + approve-all-safe) -> Today (jobs + day sheet) | Inbound -> Money | Autonomy scoreboard -> Moments -> collapsed map. Empty sections hide. Owner digest P1.
- Inspector day sheet = phone-first page/SMS at 6:30 (P1).

## Build order (v3)
1. Foundations: clock, store tables + global lock + reset, models (`models/crm.py`), geo + FSA + zone fixtures, consent engine, seed (~30 contacts incl. the 2 real jobs, FR customers, consent records, precomputed facts with quotes, interactions from the 7 tools, 2-3 at-risk estimates).
2. Agents + stubs + fixtures: triage_inbound, draft_outreach (concern-aware, language, fact filter), extract_facts (grounded), talking_points.
3. Messaging: outbox, compliance footer, ownership, simulated inbound webhook, STOP/HUMAN handling, autonomy + kill switch, followups adapter.
4. Moments + alerts (simulate + live poll with cache) + check-in drafts (safety_only vs offer).
5. Hub aggregate + money metrics; people endpoints; search.
6. Web: `/hub`, `/people`, `/people/[id]`, `/outreach` (queue + inbox threads), `/alerts`; header search + kill switch.
7. Hero loop in `demo_api_run.py` (fixture mode, no key) + unit tests + Playwright spec. **Gate.**
8. P1: calls after-call card, day sheet/briefs, research library, `/privacy`, settings (autonomy, processors), booking-form consent + notice, remediation tasks.
9. Docs, commit, push.

---
## v2 plan (superseded where v3 differs)


One hub where AI runs every step except the inspection itself (intake, booking, prep, reports, estimates, payments, follow-up, relationship memory, flood check-ins and mold research), while staff approve and edit through an autonomy dial instead of juggling seven tools.

## How this plan was made
v1 was attacked from four angles: **Owner/value** (would Michael pay for it, does it sell), **Privacy/law** (CASL, PIPEDA, Quebec Law 25), **Engineering** (can it be built and demoed reliably on this codebase), and **Staff/ops** (would the team actually use it daily). The subagent tool is unavailable in plan mode, so these reviews were run directly; **the first build step re-runs them as 4 independent subagents against this plan and patches it before any code is written.** Accepted attacks are tagged [O], [P], [E], [S]; rejected ones are listed at the end.

## Goal
People at Mold Busters only (a) inspect/remediate and (b) approve or edit what the AI prepared. Everything else (answering, booking, reminding, prepping, writing, quoting, invoicing, chasing, remembering, reaching out, researching) happens in ONE hub instead of Google Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email.

## The hero loop (what the demo proves first) [O]
1. A rainfall/flood alert covers Gatineau (simulated for the demo; Environment Canada has **0 water alerts right now**, verified: snowfall 26, special statements 23, wind 15).
2. The hub lists matching past customers; the ones who asked for storm check-ins come first.
3. AI drafts helpful check-in texts (checklist + "want a free 10-minute video check?" booking link). Staff approve them in one batch.
4. A customer replies: "Thanks! Also we're expecting a baby in March." The AI turns that into a **pending fact** with the quote, schedules a "nursery humidity" moment for February, and creates a booking from the link.
5. The profile shows everything about her from all 7 tools on one timeline, plus **talking points** for the next human call.
Every other feature hangs off this loop.

## Current state (from the code)
- `api/app/models/passport.py`: all data hangs off `Case`; customer is inline (`Customer{type, alias}`, `Booking.contact: BookingContact{name, phone, email, address, city, postal_code}`); `timeline: list[Event]`; `live.transcript`; `followups`.
- `api/app/store.py`: one SQLite table `cases(id, data JSON)`, per-case asyncio locks.
- `api/app/main.py`: 669 lines, 34 endpoints incl. `/cases/{id}/book`, `/followups/draft`, `/followups/approve-batch`, `/dashboard`, `@app.on_event("startup")` seeding.
- `api/app/agents/tasks.py` + `llm.structured` (Pydantic, retries, cache, throttle, fixtures, e2e stubs).
- Web: `/dashboard`, `/cases/[id]/inspect|review`, `/assess/*`, `/compare`, `/proof`, `/try`; `StaffShell` nav in `components/ui.tsx`.

## Lifecycle: AI vs human
| Stage | AI does | Human does | Autonomy default |
|---|---|---|---|
| 1 First contact (web, Bruce, SMS, email, voicemail transcript) | answers FAQs, triages, creates contact + case, pre-assessment | escalations only | auto-reply FAQs; drafts otherwise |
| 2 Booking | slots, book, confirm, remind (48 h + 2 h), reschedule | none | **auto** |
| 3 Prep | inspector brief (concern, photos, access, pets, parking, talking points) + route-ordered day sheet | reads it | auto |
| 4 Inspection | field notes -> findings/readings (exists) | **inspects** | n/a |
| 5 Report + estimate | drafts both, runs checks (exists) | reviews, edits, approves | draft |
| 6 Payment | deposit/invoice link, reminders, receipt (simulated) | exceptions | auto for reminders |
| 7 Sales follow-up | concern-aware follow-ups (exists), objection replies, expiry nudge | approves | draft |
| 8 Relationship | facts, moments, talking points, review/referral asks | approves | draft |
| 9 Event outreach | flood/rain alerts -> opted-in past customers | approves batch | draft |
| 10 Research | mold library, lab-result explanations | reads | auto |

## Relationship memory, done so it helps rather than creeps [O][P]
- **Facts serve humans first.** The main output is *talking points* on the profile and the inspector brief ("daughter starting grade 1 this fall; asked about the basement smell last time"), because Rockefeller's cards worked when a person used them.
- **Automated messages reference personal facts only when all hold:** the customer opted into "personalised reminders", the fact is approved, its category is allowed for messaging (home, preferences, property events; *not* health, *not* children by default), and it's used lightly ("Back-to-school season is a good time to check bedroom humidity" rather than naming the child).
- **Children:** stored only as coarse household facts ("school-age child", "expecting a baby"), never names, ages or schools.
- **Health:** stored on the case when needed for the recommendation (IAQ), never used in marketing.
- **Retention:** facts expire after 3 years unless re-confirmed; rejected facts are deleted, not hidden.
- **Customer-visible memory** at `/me/[token]`: what we remember, edit/delete, channel + personalisation toggles (Law 25 s.8.1 profiling notice, PIPEDA access/correction).

## Auto-extract + edit everywhere [S]
- **Sources:** Bruce transcripts, inbound SMS/email, staff notes (typed/dictated), the booking form, the pre-assessment answers, imported tool history.
- **Structured sources skip the AI** (booking form -> name/phone/address/customer type; answers -> room/occupant) [E].
- **Free text** goes through `extract_facts` with a grounding check: the quote must appear verbatim in the source, or the fact is dropped.
- **Approval tiers to avoid fatigue:** home/property and contact-preference facts with a verbatim quote auto-approve; household, health, life-event and anything with confidence < 0.7 wait for staff. "Approve all low-risk" button and a daily digest.
- **Every AI-filled field is inline-editable** with provenance (source chip, quote, who edited); edits are logged and kept as feedback examples for prompts.

## Data model (Pydantic v2; SQLite tables with indexed key columns + JSON payload) [E]
- `Contact`: id, name, phones[], emails[], language, properties[] {address, postal, fsa, lat, lon}, case_ids[], tags, `consent` {sms, email: express|implied|none, source, granted_at, implied_until, opt_out_at}, `prefs` {channel, quiet_hours, storm_checkin_opt_in, personalised_reminders}, do_not_contact, `merged_into`.
- `ProfileFact`: id, contact_id, text, category (home|household|life_event|preference|health|work|other), source {kind, ref, quote}, learned_at, confidence, status (pending|approved|rejected), message_use (never|light), follow_up {date, reason}?, expires_at, edits[].
- `Interaction`: id, contact_id, case_id?, at, system (google_calendar|freshbooks|asana|close|brain|dialpad|email|sms|moldflow), kind, summary, ref.
- `Message`: id, contact_id, case_id?, channel (sms|email), direction (out|in), subject?, body, trigger {kind, ref}, facts_used[], status (draft|approved|scheduled|sent_simulated|blocked|failed|received), blocked_reason?, approved_by?, sent_at?, in_reply_to?.
- `Moment`: id, contact_id, kind, due, reason, source_fact_id?, status (upcoming|drafted|done|skipped).
- `AlertEvent`: id, source (env_canada|simulated), type, area, polygon, starts, ends, text_en/fr, matches[] {contact_id, priority}, status.
- `MoldTopic`: genus, summary, habitat, what it means, what to do, sources[] (Health Canada / EPA / CDC), reviewed_by.
- `Task`: kind, contact/case, owner, due, status. `AuditLog`: actor (ai|user), action, target, at, detail.
- `Case.contact_id` added; migration links existing cases (match by phone/email, else name+postal, else new contact); duplicate review queue with merge [E].

## Engines (deterministic, unit-tested)
- `engine/consent.py` [P]: CASL. Every commercial message needs express consent, or implied consent (existing business relationship: 2 years after a purchase, 6 months after an inquiry). Sender ID + working unsubscribe ("Reply STOP" / email link) in every message; opt-outs take effect immediately. Quiet hours 21:00-09:00 in the contact's time zone. Caps: 1 marketing message per 7 days; a safety check-in once per alert. A blocked message keeps its reason.
- `engine/moments.py`: back to school (~Aug 20), spring melt (Mar 15, basement customers), fall drainage (Oct 1), 1-year post-remediation clearance check, estimate expiry -14 days, nursery humidity 1 month before a due date, plus fact follow-up hooks. **Demo clock** (`MOLDFLOW_TODAY` override + UI "time travel") so moments can be shown on stage [E].
- `engine/floods.py`: poll `api.weather.gc.ca/collections/weather-alerts/items` every 15 min (cached); keep water-related types (rainfall, flood, storm surge, freezing rain, special statements whose text mentions heavy rain/flooding/runoff); match polygons to contact coordinates; priority = storm opt-in > past water/basement case > others in area; saved real alert polygons as fixtures + "simulate alert" for demos.
- `engine/geo.py`: FSA centroid table for the service area (Ottawa, Gatineau, Montreal, Laval, Toronto FSAs); point-in-polygon (ray casting).
- `engine/autonomy.py`: per action type `auto` / `draft` / `off`, editable in settings; every auto action goes to the audit log; a kill switch pauses all outbound.
- `engine/scheduler.py`: FastAPI lifespan task (replaces deprecated `on_event`) running alerts poll, daily moments, reminders; every job also has a "run now" endpoint [E].

## AI agents (`llm.structured`, Pydantic outputs, fixtures for demo)
- `extract_facts` -> `list[FactDraft{text, category, quote, confidence, follow_up?}]` + grounding check.
- `triage_inbound` -> `{intent, reply_draft, escalate, facts[]}` (FAQ + case context).
- `draft_outreach` -> `{channel, subject?, body, facts_used, reason}`; SMS <= 320 chars; prices only from `pricing.yaml`; `checks.offer_check`; unsubscribe line appended by code, not the model.
- `talking_points(contact)` -> 3 bullets for a human call.
- `inspector_brief(case, contact)` -> one page.
- `mold_brief(genus, lab_context)` -> only from `MoldTopic`, with citations; only after a lab result names the mold (never from photos).
- LLM budget [E]: one extraction call per interaction (not per sentence); cached by content hash; fixtures for every demo step; seed data ships with precomputed facts so the hub works with zero model calls.

## Integrations
- Messaging adapters: `Outbox` (simulated now); Twilio SMS + Resend email behind env keys; inbound webhook endpoints shaped like Twilio's so going live is a config change.
- Tool imports: export-shaped JSON per tool (Calendar, FreshBooks, Asana, Close, Dialpad, email); read-only first, write-back later [S].
- Environment Canada (live, no key). Provincial flood feeds (Quebec, Ontario conservation authorities) = later.

## Screens (P0 = hero loop)
| Route | Priority | What |
|---|---|---|
| `/hub` | P0 | today: approvals, escalations, moments due, alert matches, today's bookings; open-estimate revenue; map (customers + alerts, list fallback offline); "7 tools -> 1" |
| `/people`, `/people/[id]` | P0 | directory; profile with facts (approve/edit/reject inline, quote, source), talking points, consent/prefs, homes, moments, cases, messages, unified timeline |
| `/outreach` | P0 | approval queue by trigger, batch approve, edit, outbox, blocked-with-reason, simulate reply |
| `/alerts` | P0 | live + simulated alerts, matches, draft check-ins |
| `/inbox` | P1 | inbound SMS/email with triage + drafted replies |
| `/schedule` | P1 | inspector day sheets + briefs (printable) |
| `/research` | P1 | mold library + briefs |
| `/settings/autonomy` | P1 | dial + kill switch |
| `/me/[token]` | P1 | customer memory + preferences |
Existing pages keep working; the hub becomes the staff home, `/dashboard` folds into it.

## Code structure [E]
Split `main.py` into routers: `routers/cases.py` (existing), `people.py`, `messaging.py`, `alerts.py`, `hub.py`, `research.py`; new `store` tables in `store.py`; types regenerated (`npm run gen:types`).

## Synthetic data
~30 contacts (Ottawa, Gatineau, Montreal, Laval, Toronto) with histories in the 7 tools, consent records, precomputed facts with quotes, upcoming moments; labelled "synthetic demo data" on every screen. The 2 real sample jobs become 2 contacts.

## Phases (MVP ~14 h = phases 1-6; full ~22-26 h)
0. Re-run the 4 antagonistic reviews as subagents on this plan; patch it.
1. Models, tables, routers split, contact migration + merge queue, geo, synthetic seed with precomputed facts.
2. People pages + unified timeline + inline edit with provenance.
3. Consent, autonomy, outbox, moments (+ demo clock), outreach drafting + batch approval.
4. Fact extraction loop (transcripts, notes, booking form, replies) with grounding + approval tiers; talking points.
5. Alerts: EC poll, fixtures, simulate, matching, check-in drafts.
6. Hub page.
7. Inbox triage + simulated inbound webhook.
8. Inspector briefs + schedule.
9. Research library + briefs; customer memory page; autonomy settings.
10. Tests, demo script, docs.

## Verification
- Unit: consent (express/implied windows, opt-out, quiet hours, caps), moments dates, flood matching (polygon fixtures), fact grounding, drafter uses only allowed facts and never prices, autonomy blocks.
- `demo_api_run.py` extended with the hero loop, passing offline (fixtures).
- Playwright: alert -> drafts -> batch approve -> reply -> pending fact -> approve -> moment scheduled -> profile timeline.
- All existing checks stay green (pytest, tsc, eslint, build, current e2e).

## Risks
| Risk | Mitigation |
|---|---|
| Creepy personalisation | talking points first; personalised-reminders opt-in; light-touch rules; no child names |
| Legal (CASL / Law 25) | consent engine blocks sends; unsubscribe by code; memory page; retention expiry; audit log |
| Approval fatigue | tiers, batch approve, autonomy dial, digest |
| No real alerts during the demo | saved real polygons + simulate |
| Free-tier LLM limits | precomputed seed facts, fixtures, caching, one call per interaction |
| Scope | P0 hero loop first; P1 only after it passes |

## Rejected attacks
- "Drop personal facts entirely" [P]: rejected; with opt-in, coarse storage and talking-points-first it's useful and lawful.
- "Real Twilio now" [O]: rejected per your choice (simulated until keys).
- "Use news APIs for floods" [E]: deferred; official alerts are reliable and free.
