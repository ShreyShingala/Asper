# Devpost submission: Asper

Copy each section into the matching Devpost field. Anything we measured says so; anything simulated (texts, emails, payments) says so too.

---

## Project title
**Asper**, built on MoldFlow

## Tagline
**Know what you're dealing with before anyone shows up. AI runs the office; people do the inspecting.**

## Elevator pitch
Asper takes the guesswork out of mold. A customer shows us the problem from their phone, with Bruce, our voice agent, coaching the camera, and gets a real report in minutes. On the Mold Busters side, every photo, reading, message and dollar ends up in one case file, the AI drafts the follow-ups, and staff just approve or deny.

---

## Inspiration

Mold Busters has been inspecting homes in Ottawa and Quebec for 20+ years and wants to go "AI-native." Their own pitch starts with someone who finds mold at 11 PM, calls, and nobody picks up.

We didn't make up the problem. We opened their sample jobs and found the same story every time:

- **Job 1 (Kanata, on-site):** the homeowner asked where the moisture was coming from. They got four canned texts offering 10% off. The $4,181 estimate was viewed and never accepted.
- **Job 2 (Montreal, virtual, tenant):** health symptoms, a landlord who wouldn't answer, and nothing to help her with him. Her $597.87 estimate was viewed and never accepted.
- **Behind the scenes:** one customer was spread across Calendar, FreshBooks, Asana, Close, Brain, Dialpad, email and 15 Telegram groups. The report went out 45 hours after the visit.

The owner told us what he wanted. He's tired of customers emailing photos with no context. He wants virtual inspections without an app, a report right away, and his team out of the admin work so they can inspect.

---

## What it does

Asper removes the guesswork from mold inspections.

It does more than reassure people. Asper is a working inspection and evidence agent. Customers either show us the problem with a guided photo intake, or go live with Bruce, a browser voice agent who coaches their camera in real time. Behind it, MoldFlow keeps one "Evidence Passport" per case for staff. Every finding has a photo behind it, every sentence in a report cites one, money at risk is tracked, and customer messages follow Canada's anti-spam and privacy rules (CASL and Quebec's Law 25).

**CLIENT PIPELINE**

Visit Mold Busters → Choose a virtual inspection → Answer a few tap-to-answer screening questions → **Go live with AI (Bruce)** or do a guided photo upload (EN/FR) → See your personalized pre-assessment and price → Book a visit or buy the full AI report ($20)

**If needed:**
- **Tenant action pack ($50):** we write to your landlord for you. The letter opens ready-to-send in Gmail or Outlook from moldbusters@gmail.com, with you copied. If nothing happens, the next step (formal notice, city complaint, tribunal paperwork) is drafted on schedule.
- **Stay in touch with a real person:** text us any time. The AI answers routine questions right away and drafts the rest from your case; a Mold Busters staff member approves anything personal or involving money.

**Live mode (Bruce):** Bruce talks you through 2 to 4 photos: the area around the spot, then the spot up close. He gives camera cues like "come closer" and "turn on a light," and you tap the shutter when the orange box turns green. You can skip a shot, and the call wraps up by itself in about two minutes. He uses an ElevenLabs voice, with a free browser voice as backup.

**ADMIN PIPELINE**

Customer finishes their virtual assessment → Photos, transcript and pre-assessment are filed under a project automatically → The AI drafts replies, booking offers and follow-ups → Staff approve or deny from the Hub → An inspector visits and uploads the walkthrough video → The AI pulls key frames, reads the transcript and fills in the findings → A report where every sentence cites a finding → Approve → The client email goes out by itself

**Around it:**
- **Hub:** three rows to work through: customer conversations, virtual assessments, and on-site reviews.
- **Asper (chat):** ask anything about any customer. For example: "I'm facing legal issues with the Smiths Falls client, put together all the evidence." It returns a dated summary and a ZIP with every message, photo, finding and approval, plus a file of fingerprints that shows nothing was altered.
- **Map and Customers:** every customer pinned on a map by postal code; click one to read the conversation and what the AI has learned about them.
- **Memory and follow-ups:** say "we're expecting a baby in May" and Asper remembers it. "Text me next week" puts a follow-up in the queue, which sends itself when it's due.
- **Proactive check-ins:** storm warnings for opted-in customers, and personal check-ins drafted from what people told us. Those always wait for approval.

**Who does what:** the AI gathers, drafts, remembers and queues. People inspect, and approve anything with money, personal details, or a report in it.

---

## How we built it

- **Web:** Next.js 16, React 19, Tailwind v4, Mold Busters orange (#C2410C, passes accessibility contrast), Playwright browser tests. Layout follows the open-source taste-skill guidelines for app screens.
- **API:** FastAPI, a Pydantic v2 "Evidence Passport" case model, SQLite.
- **AI:** every model call returns a checked structure, with a backup model when the first fails, saved responses for offline demos, and a label showing whether output is live or replayed. Free OpenRouter models do vision and chat. When the daily quota runs out, rule-based fallbacks keep Bruce, the photo checks and the reports working.
- **Voice:** ElevenLabs Agents. The key stays on the server; the call only gets a signed link.
- **Video:** walkthrough audio transcribed locally with faster-whisper; frames pulled with ffmpeg.
- **Rules in code, not in the prompt:** prices come from Mold Busters' published list (never the AI), along with consent windows, STOP, quiet hours, the kill switch, and the rule that health details never go in a message.
- **Data:** six real Mold Busters jobs from the sample packs, with their photos, timelines, estimates and the inspectors' Telegram notes. Reference reports were never fed to a model.

---

## Challenges we ran into

1. **"AI that detects mold" is the wrong product.** 24 sample photos can't train a detector, and calling something mold from a photo is a liability. We built a pre-assessment that says what it sees and what it can't tell.
2. **Free AI runs out.** We hit the daily limit mid-build, and Bruce started answering everything with "sorry, I didn't get that." Now every AI step has a working fallback.
3. **White walls fooled auto-capture,** so we moved to a manual shutter and cut the photo list to 2 per spot.
4. **Phone cameras need HTTPS.** We used a temporary Cloudflare tunnel with a QR code; it drops now and then, so the app never holds a request open long enough to break.
5. **Compliance isn't a footer.** Consent expiry, quiet hours and marketing caps had to be tested rules, not a line on a slide.

---

## Accomplishments we're proud of

- **End to end in one demo:** phone QR → live call → report → $50 tenant pack → staff Hub → on-site video → approved report.
- **Report lock:** reports can't be approved while a check is failing, for example "swab positive but not in the estimate's scope."
- **Measured on the 24 sample photos:** 0 photos where the AI called something mold as fact; agreement with the organizers' captions rose from 140 to 162 out of 168; median response time fell from 11.8 s to 2.3 s. That's a small sample, not an accuracy benchmark.
- **90 backend tests and the browser tests pass,** including the full automatic messaging flow.

---

## What we learned

- For a trades business, useful means money and time. Answering the customer's actual question beats a flashier vision demo.
- Practical means real price lists, a human signing off reports, and privacy rules written into the code.
- A demo that survives a dead Wi-Fi or an empty AI quota is worth more than one more feature.

---

## What's next

- Real texting and email (Twilio / Resend). Sending is simulated today.
- Stripe for the $20 report and the $50 pack (the checkout is a test screen today).
- Live ElevenLabs testing on a credit budget.
- Syncing with Close, FreshBooks and Calendar, and importing the Telegram history for real.

---

## Try it

```bash
cd moldflow/api && uv sync
cd ../web && npm ci
cd .. && scripts/dev.sh        # API on :8000, web on :3000
scripts/tunnel.sh              # optional: HTTPS link + QR for phones
```

| What | Where |
|---|---|
| Customer | http://localhost:3000 (add `?demo=1` to use the sample video as the camera) |
| Hub | http://localhost:3000/hub |
| Map | http://localhost:3000/map |
| Text as a customer | http://localhost:3000/demo-texts |
| Tenant pack demo | http://localhost:3000/assess/demo-tenant |
| On-site video to upload | `demo-videos/Stittsville_bathroom_walkthrough.mp4` |

**Video:** paste the demo recording link here.
**Repo:** https://github.com/ShreyShingala/mold-busters-bruce

## Built with
`nextjs` `react` `typescript` `tailwindcss` `fastapi` `python` `pydantic` `sqlite` `openrouter` `elevenlabs` `faster-whisper` `ffmpeg` `playwright`
