# 5. Evidence: measured, projected, simulated

Use these labels on every slide. The organizers asked for this, and the judge will probe it.

## Measured (we ran it)
### Photo analysis: 24 sample photos, scored against a golden set
Agreement with the organizer captions on the sample pack (n=24, illustrative; **not an accuracy benchmark**). Seven checks per photo: right image type, mentions the key idea, no overclaiming, sensible boxes, quality flag, useful follow-up question, short enough to say aloud.

| | Baseline | After overnight tuning |
|---|---|---|
| Total score | 140.0 / 168 | **162.0 / 168** |
| Photos where the AI claimed mold as fact | 0 | **0** |
| Image type recognised (thermal / swab kit / meter / regular) | 20 / 24 | **23 / 24** (thermal 6/6, meters 2/2, swabs 3/4) |
| Observations short enough to speak (≤ 12 words) | 5 / 24 | **24 / 24** |
| Median time per photo | 11.8 s | **2.3 s** |

### Walkthrough video: what Bruce sees on a real call
59 frames (one every 3 s) from the 288×640 sample walkthrough, labelled by a person.

| | Before | After |
|---|---|---|
| Unusable frames (selfies, boxes, blank wall) flagged instead of described | 3 / 7 | **5 / 7** |
| Vent/hose frames consistent with the 3 still photos | 11 / 14 | **12 / 15** |
| Overclaims | 0 | **0** |

### Camera thresholds, tuned on the walkthrough
- **"Too dark" warnings on the vent close-ups:** 0 false warnings (the darkness threshold stayed at luma 42).
- **False "hold still" warnings on steady close-ups:** 5 → 3.
- **Steady close-up frames rejected at capture:** 11% → 7%.

### Bruce: 8 simulated personas
These ran on a **stand-in**: the same prompt and tools on a free text model, not the real ElevenLabs voice agent. So they are **not verified with a live call**. Eleven checks per call: answers saved correctly, concern saved, required photos taken, finished, right service recommended, no rule broken, short turns, no repeated questions, a summary with nothing invented, persona-specific checks, inside 5 minutes.

| | Baseline (original prompt, 4 personas) | Latest (8 personas) |
|---|---|---|
| Score | 32.98 / 44 | **85.14 / 88** |
| Calls finished | 2 / 4 | **8 / 8** |
| Rule violations (mold claims, prices, medical advice, asking for name/phone/email…) | 0 | **0** |
| Right next step recommended | n/a | **8 / 8** (tenant → landlord letter; Australia → remote report; health → air quality test) |

### Software checks (latest run)
- Backend unit tests: **80 passed**, including 21 hub tests (consent windows, safety vs offer, opt-out, caps, quiet hours, footers, geography against real zone outlines, fact grounding, the health guard, moments, booking consent, research brief, the full hero loop, STOP/HUMAN, kill switch).
- **The demo script runs every beat through the API**, including the hub loop, with **no AI available** (quota exhausted).
- Browser tests (Playwright): **19 / 19**.
  - The live-call screen, with the real walkthrough video as the camera, at desktop, iPhone 13 and Pixel 7 sizes.
  - Camera denied, quota exceeded, dropped call and zero photos all fall back to the upload flow.
  - The full hub loop in the browser.
- Real Environment Canada geography: **all 38 service-area postal areas fall inside their correct forecast zone**.

### Real-world facts from the sample pack (not our measurement)
- $4,778.87 in estimates sent, viewed and not accepted.
- An 82-minute report write/review window with 2 admins (elapsed time, not measured labour).
- 45 h 35 min from inspection to report email (elapsed turnaround).
- 4 canned texts + 1 manual text; 6 generic emails.

## Projected (not measured; say so)
- **Time saved on reports:** the draft is generated in seconds; a person still reviews it. We have **not** measured review time with Mold Busters staff.
- **Conversion lift from concern-aware follow-up:** plausible, not measured. Two sample jobs prove nothing statistically.
- **Staff hours saved by instant answers and auto-reminders:** not measured.

## Simulated (labelled in the app)
- SMS and email sending (`sent_simulated`), until Twilio/Resend keys are added.
- Payments, booking confirmations and CRM/FreshBooks/Calendar sync.
- The 28 hub customers and their histories in the 7 tools (marked "synthetic").
- The rainfall warning in the demo (real zone outline, simulated alert; there were no water alerts on demo day).
- "Recovered by MoldFlow": counts estimates accepted via a MoldFlow reply in the demo.

## Not verified yet
- Bruce on the real ElevenLabs agent (no key on the build machine), including real-audio transcription of postal codes.
- The hub's AI-written messages: all hub drafts shown so far used the reviewed templates, because the free AI quota was exhausted. The AI path switches on automatically when quota returns.
- Real phones (Playwright emulates phone screens in Chromium) and Wake Lock on devices.

## Spend
Everything ran on the OpenRouter free tier ($0). ElevenLabs: 0 calls.
