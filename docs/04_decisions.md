# 4. Decision log

Each entry gives the context, what we decided, the alternatives, and why. The tags show which review forced it: **[RT]** build-plan red team, **[PM]** pre-mortem, **[ON]** overnight measurement, **[H-O/P/E/S]** hub reviewers (owner / privacy / engineering / staff).

---

## Product decisions

### D1. The AI never diagnoses mold
- **Context:** The team's first idea was "detect mold in a livestream". The sample reports say mold can't be confirmed without sampling.
- **Decision:** The vision AI describes only what is visible and marks "areas worth a closer look". It never says "mold", never names a species from a photo, and never gives medical advice. Mold identity comes only from a lab result.
- **Alternatives:** A trained YOLO/SAM detector (24 photos can't train it); calling it "possible mold" (still implies a diagnosis).
- **Why:** Liability, honesty, and it matches how Mold Busters' own reports are worded. On the 24 sample photos, the AI claimed mold as fact **0 times out of 24** (measured).

### D2. One case record (the Evidence Passport) for all six stages
- **Context:** The pain is fragmentation: 7 tools with conflicting records.
- **Decision:** One typed record (Pydantic v2) carries concern, answers, photos, AI observations, readings, findings, flags, report, estimate, booking, timeline and follow-up.
- **Alternatives:** Separate tools per idea (a bundle that demos poorly and is still fragmented).
- **Why:** "One case, from first concern to confirmed next step" is the product. Every stage can cite evidence from earlier stages.

### D3. People approve anything that matters
- **Decision:**
  - Inspectors confirm AI findings, and a named reviewer approves reports.
  - Blocking checks lock approval.
  - Anything with a dollar amount, or that uses what we know about someone, can never be sent by the AI alone.
- **Why:** Trust and liability. The staff reviewer showed that over-asking for approval kills adoption, so routine logistics (confirmations, reminders, fixed FAQ answers) are allowed to send on their own **[H-S]**.

### D4. Prices come only from Mold Busters' price list
- **Decision:** `pricing.yaml` holds the documented prices (virtual $100, on-site $195 + HST, air quality test $520 + tax, the proposed $25 remote report) and tax rules (ON 13%, QC 14.975%). The model never writes a number, and AI-invented discounts are blocked.
- **Why:** You can't learn pricing from 2 jobs, and a wrong price in front of a customer is unrecoverable **[RT]**.

### D5. The customer gets value before being sold to
- **Decision:** The pre-assessment ends with a card and a PDF the customer keeps; tenants get a landlord letter.
- **Why:** The UX reviewer said a flow that only collects data and pitches feels like a lead trap **[RT]**.

### D6. Bruce, a live camera + voice assistant in the browser
- **Context:** The owner wants an AI in the browser with no app. Their virtual inspection currently needs an app and a phone number.
- **Decision:**
  - A live call in the browser via ElevenLabs.
  - Bruce takes the photos himself through a tool and asks one short thing at a time.
  - Answers are validated by deterministic server rules that understand plain speech.
  - The upload flow is always the fallback.
- **Why:** It's the owner's vision and the strongest "AI does the job" demo, but voice is fragile, so the rules, checklist and fallbacks live in code, not in the prompt.

### D7. Follow-up answers the customer's real question
- **Context:** Job 1 asked about ERMI and the source; the texts said "10% off".
- **Decision:** Follow-up drafts read the case:
  - the concern, and the findings that point to a **moisture source** (failed ball-slope test, elevated moisture);
  - the estimate, and how long it's valid.

  A positive swab shows growth, not where the water comes from, so it isn't treated as the source **[ON]**.
- **Before/after:** "Still interested or should we close your case?" becomes "About your question on where it's coming from: the likely moisture source is the upstairs washrooms (a shower floor that doesn't drain properly), not the basement spot itself. Estimate EST-CASE01 ($4,181.00) covers those areas and holds until 2026-12-06."

### D8. The hub's hero loop is the money, not the flood [H-O]
- **Context:** The user asked for Rockefeller-style memory and flood outreach. The owner-value reviewer showed that floods are small money and the proven leak is unaccepted estimates and unanswered inbound.
- **Decision:** The demo order:
  1. an instant 11 PM answer;
  2. rescue the $4,181 estimate;
  3. the customer's reply becomes memory;
  4. flood check-ins as a short closing flourish.

  The hub's top section is money on the table plus a "recovered by MoldFlow" counter.

### D9. Memory serves people first (Rockefeller, done right) [H-O][H-P][H-S]
- **Context:** "If they have a daughter, note it and bring it up next school year."
- **Decision:**
  - Facts mainly become **talking points for staff on calls**, written as natural scripts with where they came from ("she told Bruce on Oct 24").
  - Household and children facts are **human-only**: they create a call-list task, never an automated text.
  - Automated messages may lightly reference home and preference facts. Life events need the customer's express "personalised reminders" consent.
  - Health facts never appear in messages, and are never sent to the drafting AI.
- **Alternatives:** Automatic personal texts ("How's the baby?"); dropping personal facts entirely.
- **Why:** Rockefeller's cards worked because a person used them. Automated intimacy reads as surveillance; with opt-in and coarse storage, the memory is useful and lawful.

### D10. Every fact keeps the customer's words, and can be edited
- **Decision:**
  - A fact is saved only if its quote appears verbatim in the source; otherwise it's dropped.
  - Every fact shows where it came from (call, text, Bruce, booking) and can be approved, edited (with an edit log) or deleted. Deleted facts are removed, not hidden.
- **Why:** The user asked for "auto extract and edit"; staff only trust facts they can trace; it limits AI invention; and it supports data minimisation.

### D11. Flood signal = official Environment Canada alerts, matched by postal area [H-P]
- **Decision:**
  - Poll the free public alerts API, keeping only water-related alerts (rainfall, flood, storm surge, freezing rain, and statements mentioning heavy rain) over Ontario and Quebec.
  - Match the alert outlines to customers' postal-area (FSA) centroids.
  - Priority: customers who asked for storm check-ins, then past water or basement cases, then others in the area.
  - A "simulate" button uses real forecast-zone outlines, because there were 0 water alerts on demo day.
- **Alternatives:** News scraping (unreliable); targeting by age ("reach out to old people").
- **Why:** Reliable, free and auditable. We don't target by age: people *opt in* to "please check on me". That's respectful, and it's lawful.

### D12. One timeline across seven tools, but tools stay where they belong [H-S]
- **Decision:** Every person's history from Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email sits on one timeline with source chips. FreshBooks (accounting) and Google Calendar remain the system of record; write-back is roadmap. Close sequences, Asana cards and Brain notes are what get replaced.
- **Why:** "Replace all your tools" gets a "no". "Open one tab instead of seven" gets a "yes".

### D13. A conversation has one owner: AI or a person [H-S]
- **Decision:** When staff reply, or a customer texts HUMAN, the thread flips to a person and the AI only drafts. "Take over" and "Hand back to AI" are on every profile.
- **Why:** Two senders on one thread contradict each other and confuse customers.

---

## Compliance decisions (details in [06_trust_safety_compliance.md](06_trust_safety_compliance.md))

### D14. CASL rules are enforced in code, at the only exit [H-P]
**Decision:** `messaging.send()` is the only way out, and it calls `consent.check()` first, for AI and staff messages alike. It enforces:
- consent basis and expiry: express consent, or implied consent that lasts 2 years after a purchase / 6 months after an inquiry;
- opt-outs plus a suppression list that survives contact merges;
- a frequency cap and quiet hours;
- the identity / unsubscribe / AI footer, appended by code rather than the model.

### D15. A check-in with a booking link is marketing [H-P]
**Decision:** Two kinds of storm message:
- **safety-only:** no link, no offer; may go to people without marketing consent, once per alert;
- **with an offer:** only with valid consent.

People in the area with neither consent nor water history get nothing.

### D16. Consent is collected honestly
**Decision:**
- The booking form's marketing box is **unchecked by default**, with a Law 25 profiling notice. Booking without the box gives only 6 months of implied consent.
- Imported records never get consent made up for them.
- Bruce now opens with "This call is recorded and transcribed", and transcripts feed the memory only when that disclosure was given. (Not yet deployed: no ElevenLabs key.)

---

## Engineering decisions

### D17. Free models, with a fallback for everything
- **Context:** The OpenRouter key allows 1,000 free requests a day and 20 a minute; the paid key had a $0 limit.
- **Decision:**
  - Free Nemotron vision model with reasoning off (about 2.3 s per photo instead of about 10 s).
  - Retries and an even throttle.
  - Exact-input cache plus saved fixtures, so the demo works offline.
  - A circuit breaker that stops calling the provider for the day once the quota is used up.
  - Every hub agent has a reviewed **rule-based fallback**, labelled "Template" in the UI.
- **Why:** The demo must work on bad wifi or with no quota. It did: the whole hub was built and tested on a day with the quota exhausted.

### D18. Measure prompts; don't eyeball them [ON]
- **Decision:**
  - Photo prompts are scored on 24 photos against a golden set (7 checks each).
  - Bruce is scored on 8 simulated personas (11 checks each).
  - A change is kept only if the total rises and nothing gets worse.
- **Why:** Prompt edits feel better while making things worse. Bruce v4 scored higher but was **rejected** because it pre-filled an answer the customer never gave.

### D19. Deterministic rules around the AI
- **Decision:** The following are plain code with unit tests, not prompts:
  - Bruce's checklist, and validation of what customers say;
  - estimate maths, tax and expiry;
  - the scope and conflict checks;
  - consent, quiet hours and frequency caps;
  - moment dates and alert matching.
- **Why:** The parts that must never be wrong shouldn't depend on a model's mood.

### D20. Honest data
- **Decision:**
  - The two sample jobs are loaded only from the timeline file, photo filenames and job story; the reference reports are never AI input.
  - The 28 hub customers are invented and labelled "synthetic" on every screen.
  - Sending, payments and integrations are labelled simulated.
  - Scores are called "agreement with organizer captions (illustrative)", never "accuracy".
- **Why:** The organizers asked for clarity about what's real, and the judge will ask.

### D21. A shared clock, so the demo can time-travel [H-E]
**Decision:** Every date comes from `app/clock.py`, so you can jump to February and watch the nursery-humidity moment appear, with consent windows and quiet hours staying consistent.

### D22. A gate before extra screens [H-E]
**Decision:** No secondary screen was built until the hero loop passed end to end in the demo script (no AI) and in Playwright. Extra screens (schedule, research, settings) came after.
