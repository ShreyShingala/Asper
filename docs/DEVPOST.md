# Devpost submission: Asper

> **Editor notes (don't paste this block).**
> - Each `##` heading below matches a Devpost field. Paste the text under it.
> - Every number has a label: **measured** (we ran it), **from the sample pack** (Mold Busters' own records), **simulated** (labelled in the app), **prepared demo** (worked out ahead of time for the demo), or **projected** (not measured). Keep the labels. The organizers asked teams to be clear about what works and what's simulated.
> - **Bruce has not been verified on a live ElevenLabs call yet.** If you record a working live call before you submit, update the two lines marked `[BRUCE-LIVE]`.
> - Fill in `[VIDEO]` and check `[REPO]` before you submit.

---

## Project title
**Asper**, built on MoldFlow

## Elevator pitch (Devpost "tagline", 200 characters max)
Know what you're dealing with before anyone shows up. A voice agent coaches your phone camera, AI runs Mold Busters' back office, and people do the inspecting.

## Longer pitch (for the top of the description)
Asper is the AI office for Mold Busters. A customer at 11 PM opens a link, Bruce (our voice agent) coaches their phone camera, and a few minutes later they have a pre-assessment with a real price and a way to book. Behind it, every photo, reading, message, report and dollar lands in one case file. The AI drafts the replies, the follow-ups, the report and even a lawyer-ready evidence bundle. Staff just approve or deny. AI does everything except the inspection.

---

## Inspiration

### Mold Busters told us the story themselves
Mold Busters has inspected homes in Ottawa, Gatineau and Montréal for more than 20 years, and wants to become "AI-native". Their own vision video starts at 11 PM: a homeowner finds a black patch behind the washer, calls, and nobody answers. By morning they've Googled "black mold" and they're scared.

### Then we opened their sample jobs and found the expensive version of that story
It mostly happens *after* the inspection, not before.

- **Job 1 (Kanata, on-site, homeowner).** They paid $195 + HST for an inspection. The inspector found the likely moisture sources: a shower floor that failed the ball-slope test, and a leaking tub faucet. The customer had asked one thing: *"where is it coming from?"* What they got was a $4,181 estimate and four canned texts: "I sent the estimate…", "10% off if you book this week", "checking in one last time", "still interested or should we close your case?" None of them mentioned the faucet. **The estimate was viewed and never accepted.**
- **Job 2 (Montréal, virtual, tenant).** A tenant with headaches and a cough paid for a virtual assessment. Her landlord said it was "just dust in the vents". She got a $597.87 air-quality estimate and six generic "marketplace" emails referring her to plumbers. Nothing helped her deal with her landlord. **That estimate was also viewed and never accepted.**

**From the sample pack: $4,778.87 in estimates sent, viewed and not accepted.** Job 1's report arrived **45 h 35 min** after the inspection, after an **82-minute** write-and-review window involving two admins (elapsed time, not measured labour). One customer's history was spread across **seven tools**: Google Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email. The records disagreed with each other. The booking was created on Oct 1, but its note says Sept 5, and one staff alias shows up as both the booker and the inspector.

The second sample volume (five more real jobs) showed the same pattern. Inspectors post their findings into Telegram groups ("OTT-GAT & OOT Area Deliverables", "MB Virtual Inspections 1"), and an admin re-types them into a report. A Smiths Falls inspector wrote: *"The client wanted what was advertised… this is not the first time I had to deal with this situation."* A Philadelphia customer paid $100 CAD for a virtual assessment, so demand already comes from outside the service area.

### The owner told us what he wanted
His customers email photos with no context ("where is this? what's above it?"). The current virtual inspection means installing an app and registering a phone number first. He wants an AI **in the browser** that asks the right questions, and a report and estimate **right away**. Most of all, he wants his team out of admin work so they can inspect.

### So we didn't build "AI that detects mold"
Mold Busters already knows how to find mold. **They lose customers in the gaps between tools, and they lose sales because nobody answers the question the customer actually asked.** Asper is built to close those gaps.

---

## What it does

Mold remediation is a trust sale. Nobody books a $4,000 job because a text offered 10% off. They book when someone answers *"where is it coming from, and is my family safe?"* Asper makes sure every customer gets that answer, from the first midnight photo to the accepted quote and beyond.

### Who does what

| | The AI | People |
|---|---|---|
| First contact at 11 PM | Answers right away, gathers photos and context, recommends the next service at the published price | |
| Virtual assessment | Bruce coaches the camera; the AI describes each photo (never diagnoses) | |
| Inspection | | **Inspectors inspect** (the one thing the AI never does) |
| Report | Drafts it from the walkthrough and findings; every sentence cites evidence | A named person reviews and approves |
| Estimate | Built only from Mold Busters' price list | Approves anything with a dollar amount |
| Follow-up | Drafts replies that answer the customer's real question; sends routine ones itself | Approves anything with money or personal details |
| Memory | Remembers what customers said, in their own words | Approves facts about family and life events |
| Legal/insurance requests | Assembles a dated, fingerprinted evidence bundle | Decides what to send |

### CLIENT PIPELINE (the customer's phone, no app)

1. **Open the link or scan the QR.** No app, no account, no phone-number registration. English or French.
2. **Five quick taps before the camera opens.** Where's the problem (room, then which surface: wall, ceiling, window, vent, appliance…), add up to 3 spots, roughly how big, any musty smell or leak, and your postal code (or your country).
3. **A personal photo plan.** Those taps become a shot list, usually two photos per spot: the area around it, then the spot up close. At most 4 shots, about 2 minutes.
4. **Go live with Bruce, or upload photos.**
   - **Live mode:** Bruce, an ElevenLabs voice agent, coaches you like an inspector on the phone: *"Step back a little so the whole wall fits." "Tilt up to the ceiling above it." "Turn on your flashlight and point it into the vent."* An orange focus box turns green when the phone is steady, and you tap the shutter. You can retake or skip any shot. When a photo comes back, Bruce mentions one thing it shows in plain words, then gives the next cue. The phone itself checks for darkness and shake, so he can say "it's a bit dark, can you turn on a light?" The call opens with "This call is recorded and transcribed" and wraps up by itself.
   - **Upload mode:** a guided version of the same plan (wide, close-up, above, nearby), with the same AI analysis.
5. **The AI describes, it never diagnoses.** Each photo gets "areas worth a closer look" boxes and short observations. It never says "mold". Mold Busters' own reports say mold can't be confirmed without sampling, and we hold the AI to the same rule.
6. **The value moment: a real pre-assessment.** What's visible, what photos can't tell, the recommended next service and **only Mold Busters' published prices**: virtual assessment $100 (tax included), on-site inspection $195 + tax, indoor air-quality test $520 + tax. Health questions get a fixed, safe answer that points to a doctor and an air test. A PDF to keep.
7. **Next step.**
   - **Book an on-site visit:** weekday slots in Toronto time, access notes, and a marketing-consent box that is **unchecked by default**. Tenants are asked to call 1-877-566-6653 (Mold Busters' rule), enforced in the browser *and* on the server.
   - **Full AI report ($20):** every photo annotated, room-by-room analysis, likely moisture sources, recommendations in the Mold Busters report format. Anyone outside the service area (we tested Australia) is routed here.
   - **Tenant action pack ($50):** for renters whose landlord won't act (Job 2's exact situation). Asper writes the letter to the landlord from the evidence, sent from a Mold Busters address on the tenant's behalf with the tenant copied. It opens pre-filled in Gmail or Outlook. If the landlord doesn't reply in time, the next step is drafted on schedule: a formal 14-day repair notice, a complaint to the city's property standards office, a letter to public health (only if there are symptoms), tribunal paperwork for the LTB (Ontario) or TAL (Québec) that the tenant files themselves, and a letter to the ward councillor. **Nothing goes out until the tenant approves it**, and every letter says the observations don't confirm mold.
8. **Keep talking to a real business.** Customers can text any time. The AI answers routine questions right away ("what time is the technician coming?"), drafts the rest from their case for staff approval, and "text me next week" puts a follow-up in the queue.

### ADMIN PIPELINE (Mold Busters' side)

1. **The case files itself.** The moment a customer finishes, their photos, Bruce's transcript, answers and pre-assessment are filed as a project. Once they leave a phone number or email, the customer becomes a contact, with 6 months of implied consent under Canada's anti-spam law (CASL) because they made an inquiry. If they didn't book, a booking offer goes out on its own.
2. **The Hub: approve or deny.** Staff open one screen with three rows to work through:
   - **On-site reviews:** upload the walkthrough video from the visit.
   - **Customer conversations:** each thread with the AI's drafted reply. For example, Job 1 asks *"does the estimate include fixing the tub faucet or just the mold part?"* and the draft answers: the estimate covers the mold work in the upstairs washrooms and attic, and the faucet itself is a plumbing repair.
   - **Virtual assessments:** new live calls and photo intakes, with thumbnails, the recommended service and anything paid.
   Above them: messages to approve, new facts to check, people to call, messages held or blocked by the rules, and how many messages the AI sent this week (on its own, approved, edited).
3. **Inspect.** The one thing the AI doesn't do. Inspectors can tap in readings (moisture meter, humidity, thermal, swab, ball-slope) and dictate notes. "Structure with AI" turns a note into findings, and drops any finding the note never mentioned.
4. **On-site video to report.** Upload the walkthrough video and watch it fill in: key frames with "look closer" boxes, what the engineer said at that moment, findings linked to frames, the report fields (property, areas, concern, likely moisture source, recommended service) and recommendations. *(Prepared demo: see "What's real" below.)*
5. **Review and approve.** The report draft is built from confirmed findings. **Every sentence cites a finding or photo**, and uncited sentences are removed before staff see them. Checks lock the Approve button while a blocking problem is open. On Job 1 it catches *"basement swab positive, but the basement isn't in the estimate"*, plus the conflicting booking dates and staff aliases. Resolve with a note, approve as a named reviewer, and get the report PDF in Mold Busters' structure plus a FreshBooks-shaped estimate CSV. The "your report is ready" email then goes out by itself.
6. **Follow-up that answers the question.** Instead of "10% off", Job 1's follow-up says what she actually needed to hear: *"About your question on where it's coming from: the likely moisture source is the upstairs washrooms (a shower floor that doesn't drain properly), not the basement spot itself. Estimate EST-CASE01 ($4,181.00) covers those areas and holds until Dec 6."* Anything with a dollar amount is always locked for a person.
7. **Asper, the assistant that knows every project.** Ask in plain English. *"I have legal issues with case 42 from 2 years ago. Give me documentation so I can defend myself."* (Laval, a real sample job: the seller is now being threatened by the new owners.) Asper returns a numbered brief built only from the record: engagement, the client's stated concern, what the inspector documented, what was recommended, the price agreed, the work and payment on record, the communications, and the points likely to be argued, quoted word for word. Plus a **ZIP** with the full case record, timeline, every message and internal note, the approvals log, PDFs and photos, and a **SHA-256 manifest** so a lawyer can show nothing was changed. It says clearly that it's a factual record, not legal advice. Other questions work too: *"What's going on with the Stittsville client?"*, *"Who do I need to follow up with?"*, *"Which projects have estimates viewed but not accepted?"* Drafts go to the approval queue; read-only actions run right away.
8. **Memory, done right.** Text *"we're expecting a baby in May"* and Asper remembers it, with the exact quote and where it was said. Staff approve facts about family and life events. Later, a personal check-in can be drafted ("congratulations, want a free check of the nursery?"), and it **always waits for approval**. Health details are never used in a message and never sent to the drafting AI.
9. **Proactive check-ins.** When Environment Canada issues a rainfall or flood warning over a customer's area, the Hub drafts check-ins. Customers who asked for storm check-ins come first. An offer goes only to people who agreed to receive offers; everyone else gets a safety-only message with no sales pitch. French speakers get French.
10. **One place instead of seven.** A map of every customer by postal code, an all-customers view, and one timeline per person across Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email, with a source chip on every event.

### Before and after (the one the organizers asked for)
| Before (Job 1, from the sample pack) | After (Asper) |
|---|---|
| Report emailed 45 h 35 min after the inspection, after an 82-min window with two admins | Report drafted from the findings in seconds, every sentence cited; a person reviews and approves (review time **not yet measured** with Mold Busters staff) |
| "Good news: 10% off your remediation if you book this week." | Answers "where is it coming from?" with the inspector's finding and the estimate's real expiry date |
| "Still interested or should we close your case?" | Answers her follow-up question about the faucet, drafted from her case, approved in one click |
| One customer across 7 tools, with conflicting dates | One case record, one timeline; conflicts are flagged as blocking checks instead of quietly picked |
| Customer emails photos with no context | Bruce asks the questions and takes the photos an inspector would ask for |

### What's real, what's simulated
| Real (working in the demo) | Simulated or prepared (labelled in the app) |
|---|---|
| Customer intake, photo plan, guided upload, pre-assessment, pricing, PDFs | **Sending.** SMS and email are logged as `sent_simulated` until Twilio/Resend keys are added. The consent gate in front of sending is real. |
| AI photo analysis (Nemotron vision via OpenRouter), with a rule-based fallback | **Payments.** The $20 report and $50 pack use a test checkout screen. |
| Bruce's prompt, tools, shot-list rules and the ElevenLabs signed-URL connection. Rule-based Bruce and a free browser-voice mode when there's no AI | **Bruce on real audio.** `[BRUCE-LIVE]` Not yet verified on a live ElevenLabs call; his scores come from a text stand-in. |
| The Hub: drafting, approve/deny, consent rules, quiet hours, STOP, kill switch, memory, follow-up queue | **The on-site video step uses prepared clips.** The Stittsville bathroom clip is a real Mold Busters walkthrough, transcribed ahead of time with local faster-whisper, with frames cut by script. The findings are the engineer's own spoken observations, mapped to timestamps. Boxes come from an on-server pixel check (no AI), and the report draft is built from those findings. Running this automatically on *any* uploaded video is next. |
| Asper's answers, legal brief and evidence ZIP with SHA-256 manifest | **CRM sync.** Calendar, FreshBooks, Close etc. are shown as one read-only timeline plus exports. |
| Environment Canada alert matching on real forecast-zone outlines | **The storm alert in the demo** is simulated over a real zone (there were no water alerts on build day). |
| Six real sample-pack jobs with real photos, timelines, estimates and Telegram notes | **Customer text threads** are reconstructed from each job's timeline (our wording, the job's real events, dates and amounts). Client names were removed in the source, so customers carry place-based aliases ("Kanata client"). |

---

## How we built it

### Architecture at a glance
```
 Customer phone (Next.js 16, no app)              Staff (Next.js 16)
  ├─ 5 taps → photo plan                           ├─ Hub: approve / deny
  ├─ Bruce live call ── signed URL ──► ElevenLabs   ├─ Review & checks
  │     client tools: get_checklist,                ├─ Asper chat
  │     capture_photo, finish_assessment            ├─ Map, customers, timeline
  └─ upload flow (always the fallback)              └─ Demo controls
                 │                                         │
                 ▼                                         ▼
        FastAPI + Pydantic v2 ── one Evidence Passport per case (SQLite)
          ├─ llm.structured(): every AI call, typed + validated + fallback
          ├─ deterministic engines: pricing.yaml, routing, checks, booking, shot plan, tenant ladder
          ├─ Hub: contacts, facts, moments, alerts, audit log
          ├─ messaging.send(): the ONLY way out (consent gate first)
          └─ exports: report PDF, AI report PDF, FreshBooks CSV, evidence ZIP + SHA-256
                 │
     OpenRouter (Nemotron VL, free tier) · Environment Canada alerts · faster-whisper (local)
```

### The Evidence Passport: one case, every stage
The core is a single Pydantic v2 model (`models/passport.py`). The pre-assessment, Bruce's transcript, the inspector's readings and findings, the report, estimate, booking, payments, the project chat (which replaces a Telegram group per project), outbound messages, approvals and the tenant pack all live on the same typed record. There's a per-case lock, and defaults so older saved cases still load. That's why the report can cite the photo the customer took at 11 PM, and why the follow-up can cite the finding the inspector confirmed. Fragmentation was the problem, so the data model is the fix.

### One AI entry point that can't lie quietly
Every AI call (photo analysis, pre-assessment, note to findings, report, follow-up, Hub triage, fact extraction, Asper) goes through `llm.structured()`. It:
- builds a schema prompt from a Pydantic output model;
- validates the reply, and repairs it up to 2 times;
- falls back to a second model (Nemotron Nano Omni);
- caches exact inputs and replays saved fixtures, so the demo runs offline;
- has a circuit breaker that stops calling the provider for the day once the free quota is used up.

Every output carries a provenance pill in the UI ("Live AI · Nemotron · 2.3 s", "Replayed" or "Template"), so a judge can always tell live inference from a replay. Every agent has a reviewed rule-based fallback. **The whole demo runs with no AI available at all**, and `demo_api_run.py` proves it before every rehearsal.

### Vision as an evidence assistant, not a detector
Our first idea was training YOLO to detect mold. We dropped it: 24 photos can't train a detector, and diagnosing mold from a photo is a liability. Instead, the vision model (Nemotron 3.5 Super VL through OpenRouter, reasoning off so it answers in about 2-3 s) *describes and points*. It recognises the image type (thermal, swab kit, moisture meter, regular photo), marks regions worth a closer look, writes observations of 12 words or fewer that Bruce can say aloud, and asks one useful follow-up question. Very dark frames are answered without a model call. If the AI is unavailable, an on-server pixel check still boxes darker or discoloured patches and describes what it measured. The no-diagnosis rule is in the prompt *and* checked afterwards: on the 24-photo evaluation the AI claimed mold as fact **0 times** (measured).

### Bruce: an inspector you can talk to
Bruce is named after the virtual-support persona Mold Busters already uses (a sample job says "Booked by Bruce Text AI Agent"). The browser connects to ElevenLabs Agents through a **signed URL** minted by our API, so the ElevenLabs key never reaches the client. Bruce's prompt, voice, tools and limits live in one script (`setup_elevenlabs_agent.py`), which creates or updates the agent idempotently. We never edit him in the dashboard.

He drives the call with three client tools:
- `get_checklist`: the shots still needed and the `next_step`, from deterministic rules (`engine/live.py`, `engine/photo_plan.py`);
- `capture_photo`: saves the frame, runs photo analysis, returns what it shows plus the updated checklist;
- `finish_assessment`: builds the pre-assessment, even if the customer stops after one photo.

App events reach him as `[step]`, `[photo]` and `[camera]` context messages that he acts on but never reads aloud. On-device checks (brightness and motion on a 64×48 probe every 600 ms) were tuned on the real sample walkthrough video. The screening questions moved out of the call into five taps, because spoken postal codes are the riskiest thing to get right on real audio. Voice is fragile, so there are three layers of fallback: a **free browser-voice mode** (browser speech in and out, Bruce's real prompt on the free model), a **rule-based Bruce** when there's no AI at all, and the **upload flow** when the camera is denied, the call drops or zero photos are taken.

### Deterministic engines: anything that must never be wrong is code
- **Pricing** comes only from `pricing.yaml`: virtual $100 (tax included), on-site $195, IAQ $520, the proposed $20 remote report, provincial tax (HST 13% / GST + QST 14.975%), 40% deposit, valid 60 days. The AI never writes a number.
- **Routing and health:** symptoms or smell lead to an air-quality test plus a fixed health note; a leak, a big area or a hidden space leads to on-site; outside Canada leads to the remote report; tenants get the landlord path.
- **Checks:** scope, maths and conflicting records, each one blocking or a warning.
- **Booking:** weekday slots in Eastern Time, no double-booking, tenants blocked on the server.
- **Tenant ladder:** fixed, evidence-based letters with province-specific bodies (LTB form T6 / TAL), waits between steps on the shared clock.
- **Asper's legal brief** is assembled from the record by code, never paraphrased by a model. Follow-up lists come straight from the queue, too.

### The Hub: a relationship engine with consent built in
It has its own tables for contacts, facts, interactions, messages, moments, alerts, tasks and an audit log. **Every fact keeps the customer's exact words**, and a fact whose quote isn't in the source gets dropped. Home and preference facts approve themselves; household, health and life events wait for staff. Children are stored only coarsely ("expecting a baby", "school-age child"). A conversation has one owner: when staff reply, or a customer texts HUMAN, the thread switches to a person and the AI only drafts.

Every message, from the AI or from staff, goes through **one gate**, `messaging.send()`:

`do-not-contact → opted out (STOP / ARRÊT) → valid CASL consent → max 1 marketing message per 7 days → personal facts need consent → quiet hours 21:00-09:00 (held, not dropped; a reply to the customer's own text is never held) → send + footer`

The footer is added by code: Mold Busters' identity and "Reply STOP / Répondez ARRÊT". Consent has a basis and an expiry: express, implied for 2 years after a purchase, or 6 months after an inquiry. There's a kill switch on every staff page. `messaging._deliver()` is the single seam where Twilio and Resend plug in.

### Environment Canada: check in when water is coming
The Hub polls the official weather-alerts API and keeps only water-related alerts (rainfall, flood, freezing rain, and special statements about heavy rain). It matches them to customers by postal area using **real forecast-zone outlines**, with a point-in-polygon test that handles multipolygons and holes. **38 of 38** service-area postal areas land in the correct zone (measured).

### On-site video: frames + speech + findings
`prepare_stittsville_demo.py` cuts the real Stittsville bathroom walkthrough (a Mold Busters engineer reviewing the shower ceiling seam, the tub silicone and the fan), transcribes it locally with **faster-whisper**, and crops the frames to the camera area with ffmpeg. On upload, the API builds a case: frames become inspector photos, each one paired with what was said within ±6 s, findings are linked to the frames they come from, and the report draft is built from those findings with citations. In this version the clips are prepared ahead of time, and the upload is matched to a known clip.

### Measure, don't guess
We improved the AI in loops: measure, change one thing, re-measure, then keep or revert. We **never fed the reference report PDFs to a model** (the organizers' rule).
- **Photo eval** (`eval_photos.py`): 24 photos × 7 checks against a golden set built from the organizer captions.
- **Video frames** (`eval_frames.py`): 59 frames from the sample walkthrough. Does the AI flag unusable frames instead of describing them?
- **Bruce simulator** (`simulate_call.py`): 8 personas from the sample pack (job1-washroom, job2-virtual, tenant, health, outside-canada, messy, dark-room, quitter), 11 checks per call. It speaks the real ElevenLabs Agents WebSocket protocol, or runs a local stand-in with the same prompt and tools on a free text model. A `contradicts_customer` check made us **reject** a prompt that scored higher overall but saved an answer the customer never gave.

### Web: built for the phone in your pocket
Next.js 16, React 19 and Tailwind v4 on a shared design system: Mold Busters orange `#C2410C`, with every colour pair checked for WCAG AA contrast, and large tap targets. TypeScript types are generated from the API's OpenAPI schema. Playwright runs at desktop, iPhone 13 and Pixel 7 sizes, using **the real sample walkthrough video as a fake camera** and a mocked ElevenLabs conversation, so the live-call screen is tested end to end without spending credits. `/try` shows a big QR code so anyone in the room can start an assessment on their own phone.

### Fits their stack today
The report PDF follows Mold Busters' own report structure, and the estimate CSV is shaped for FreshBooks. FreshBooks and Google Calendar stay as the systems of record. What Asper replaces is the glue: the Close sequences, Asana cards, Brain notes and Telegram re-typing.

---

## Challenges we ran into

1. **Saying no to the cool idea.** "AI detects mold from your phone" demos beautifully and fails both Useful and Practical. We had AI agents argue as the owner, a skeptical engineer and the front-line staff. They killed it in the first round and pointed us at the real leak: estimates viewed and never accepted.
2. **Free AI runs out mid-build.** OpenRouter's free router forced reasoning on and returned empty content. Models threw 429s and 502s. Then the daily quota ran out, and Bruce started answering everything with "sorry, I didn't get that." We built retries, a second model, an exact cache, fixtures, a daily quota breaker and a rule-based fallback for every agent. Median photo latency went from **11.8 s to 2.3 s** (measured), and the whole demo now runs with no AI at all.
3. **White walls fooled auto-capture.** The first live call snapped photos by itself. On plain walls it fired too early, and a timer bug meant auto-captured photos never even saved (our browser tests caught that one). We moved to a manual shutter with a steady-phone indicator and cut the plan to 2 shots per spot.
4. **Spoken postal codes.** "K one A zero B one" is hard to transcribe. We wrote a spoken-answer engine ("nope" means no, "I rent" means tenant), then moved the screening questions out of the voice call entirely, into five taps. Bruce now does only what voice is good at: coaching the camera.
5. **Testing a voice agent without burning money.** We had no ElevenLabs key overnight, so we built a simulator that speaks the real Agents WebSocket protocol, plus a text stand-in. Every score from it is labelled "not verified with a live call".
6. **A prompt that cheated.** Bruce's prompt v4 scored higher, until the transcripts showed it saving "symptoms: yes" before the customer had said "No, we're all fine." We added a contradiction check, re-scored the saved runs without new calls, and rejected v4.
7. **Phone cameras need HTTPS.** We used a temporary Cloudflare tunnel with a QR code. It drops now and then, so the app never holds a request open long enough to break.
8. **Compliance isn't a footer.** A storm "check-in" with a booking link counts as a commercial message under CASL. Consent bases and expiry, safety-only vs offer, quiet hours, caps, STOP and HUMAN all had to be unit-tested, not just written on a slide.
9. **The source records contradict themselves.** The organizers warned us. We surface the conflicts as blocking checks instead of inventing a clean story.

---

## Accomplishments that we're proud of

- **End to end in one demo:** QR → five taps → Bruce's photo plan → pre-assessment with a real price → $50 tenant pack → the Hub → on-site video → cited report → approve → follow-up that answers the customer's real question → a lawyer-ready evidence bundle.
- **0 / 24** sample photos where the AI claimed mold as fact, while agreement with the organizers' captions rose from **140 to 162 / 168** and observations short enough to speak aloud went from **5/24 to 24/24** (measured; agreement with organizer captions, illustrative, not an accuracy benchmark).
- **23 / 24** image types recognised (thermal 6/6, meters 2/2), and median time per photo down from **11.8 s to 2.3 s** (measured).
- **An Approve button that refuses** while a blocking problem is open, and a report where every sentence can prove where it came from.
- **A follow-up that finally answers "where is it coming from?"**, side by side with the four real canned texts it replaces.
- **Bruce, simulated: 85.14 / 88** across 8 personas, 8/8 calls finished, 8/8 correct next step, 0 rule violations. (Measured on a text stand-in of an earlier version of Bruce, when he still asked the screening questions himself. `[BRUCE-LIVE]` Not verified with live audio.)
- **38 / 38** postal areas matched to the right Environment Canada forecast zone (measured).
- **90 backend tests pass** (consent windows, safety vs offer, opt-out, caps, quiet hours, geography, fact grounding, the health guard, the tenant ladder, pricing, checks), plus Playwright browser tests at three device sizes, and a script that runs the whole demo through the API with **no AI available**.
- **Honest labels on every screen:** measured, projected and simulated, "not accepted" instead of "lost", "elapsed" instead of "labour".

---

## What we learned

- **For a trades business, "useful" means money and trust, not models.** The biggest dollar problem wasn't finding mold. It was answering the customer after the inspection.
- **The safest AI design is "describe, cite, let a person approve."** Prices from a file, health answers fixed in code, and reports that can't contain an uncited sentence give the owner a reason to let AI near his customers.
- **Put voice where it's strong.** Voice is great for "come closer, turn on a light" and bad at postal codes. Taps for facts, voice for coaching.
- **Rules belong in types and tests.** "Health facts can't be used in messages" is a property of the data model, not a reminder in a prompt.
- **Measure every change.** Several "obvious" prompt improvements made a persona worse. Keep-or-revert with a fixed scorer stopped us shipping them.
- **A demo that survives dead Wi-Fi and an empty AI quota beats one more feature.**

---

## What's next for Asper

- **Process any on-site video automatically:** run frame extraction, Whisper and finding extraction on upload instead of on prepared clips.
- **Real sending:** plug Twilio and Resend into `messaging._deliver()`. The consent gate is already in front of it.
- **Real checkout:** Stripe for the $20 report and the $50 tenant pack.
- **Bruce on real calls:** verify the simulated scores with live ElevenLabs calls on a credit budget, plus iPhone Safari and Android Chrome hardware testing (Wake Lock, flashlight, permission prompts).
- **Two-way sync** with Close, FreshBooks and Google Calendar, and a real import of the Telegram history.
- **Staff logins and roles** (office / inspector / owner), with profile views audited; a privacy impact assessment and data agreements for the US processors.
- **The flywheel:** inspector-confirmed findings become labelled evidence, collected with consent. That's the honest way to eventually train a vision model on Mold Busters' own data.
- **Questions for Michael:** is the virtual assessment free or $100 today? What should the remote report cost? Is an AI-only pre-assessment acceptable outside Canada?

---

## Built with
`python` `fastapi` `pydantic` `sqlite` `reportlab` `uv` `typescript` `nextjs` `react` `tailwindcss` `openrouter` `nvidia-nemotron` `elevenlabs` `faster-whisper` `ffmpeg` `environment-canada-api` `playwright` `pytest` `openapi` `cloudflare-tunnel`

---

## Try it out

```bash
cd moldflow/api && python -m uv sync      # or: uv sync
cd ../web && npm ci
cd .. && scripts/dev.sh prod              # API on :8000, web on :3000
scripts/tunnel.sh                         # optional: HTTPS link + QR for phones
```
Works offline with no keys: start the API with `MOLDFLOW_DEMO_MODE=fixture`.

| What | Where |
|---|---|
| Customer (phone) | `/` (or scan the QR on `/try`); add `?demo=1` to use the sample walkthrough video as the camera |
| Staff Hub (approve / deny) | `/hub` |
| Asper (ask anything, evidence bundles) | `/muse` |
| Text as a customer (memory, follow-ups) | `/demo-texts` |
| Tenant action pack demo | `/assess/demo-tenant` |
| On-site video to upload | `demo-videos/Stittsville_bathroom_walkthrough.mp4` (Hub → On-site reviews) |
| Review + approve (blocking checks) | `/cases/job1/review` |
| Before / after | `/compare` |
| Map and customers | `/map`, `/customers` |
| Storm check-ins | `/alerts` |
| Proof (measured vs projected vs simulated) | `/proof` |

**Video:** `[VIDEO]`
**Repo:** `[REPO]` https://github.com/ShreyShingala/mold-busters-bruce

---

## Team
- **Shrey Shingala:** product direction, decisions, review.
- **Lucas Vu:** design system, Bruce's live voice mode, booking, the client and admin pipelines.
- **Devin (AI agent):** planning, multi-agent reviews, backend, frontend, evaluations, tests and docs, under the team's direction.
