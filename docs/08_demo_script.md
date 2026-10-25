# 8. Demo plan: live pitch (5 min) + Devpost video (3 min)

**The story in one line:** *A customer at 11 PM gets a real answer in minutes; Mold Busters' staff just approve or deny; AI does everything except the inspection.*

**Who's judging:** Michael, the owner. Non-technical and a big AI fan. Scoring is Useful 10 / Working 10 / Practical 10. One before-and-after example is required, and teams have to say clearly what works and what's simulated. Ties go to Usefulness.

## What each beat proves
| Beat | Useful | Working | Practical | Required item |
|---|---|---|---|---|
| Job 1's canned texts + $4,778.87 not accepted | ● | | | **Before** |
| Bruce + pre-assessment with a real price | ● | ● | | |
| Hub: approve the faucet answer | ● | ● | ● | **After** |
| On-site video → cited report → approve | ● | ● | ● | |
| Asper legal brief + evidence ZIP | ● | ● | | |
| "Real vs simulated" close | | | ● | **Honesty** |

---

## Decide this first: how to show Bruce
Bruce has **not been tested on a live ElevenLabs call yet**. Voice on a stage (room noise, laptop speakers, Wi-Fi) is the riskiest part of the demo.

1. **Before demo day:** run 3 real calls on the demo laptop, in a room like the venue: `/?demo=1` (the sample walkthrough video stands in for the camera) and the laptop mic. Each call uses ElevenLabs credits.
2. **Decision rule:**
   - **3 of 3 calls clean** → show Bruce live, using `?demo=1` on the laptop. That's more reliable than a phone over a tunnel.
   - **1-2 of 3** → show live, but have the Devpost video's Bruce clip queued in a tab. If he stalls for more than 5 s, say "here's one we recorded" and play it.
   - **0 of 3** → set `LIVE_VOICE=mock` (free browser voice running Bruce's real prompt), or show the upload flow. Play the recorded clip for the voice.
3. **Record the Devpost video first.** It gives you a backup clip of every beat.
4. If a live call works, update `[BRUCE-LIVE]` in `DEVPOST.md` and the "Not verified yet" section in `05_evidence.md`.

Stage tips: Bruce can hear his own voice through the laptop speakers and interrupt himself. Test the volume in the room, keep the presenter close to the mic, and don't talk over him.

---

## Setup (T-60 min)
1. `scripts/dev.sh prod` (production build). Check http://localhost:3000 and http://localhost:8000/docs.
2. `cd moldflow/api && python -m uv run python ../scripts/demo_api_run.py` must print `DEMO PATH PASSED`. It resets the data at the start.
3. `curl -X POST localhost:8000/admin/reset`. This reseeds the 6 sample-pack customers and `/assess/demo-tenant`. Open `/?reset=1` once so the browser forgets the last case.
4. If you'll use a phone: run `scripts/tunnel.sh`, set `NEXT_PUBLIC_PUBLIC_URL`, and open `/try` for the QR.
5. Copy `demo-videos/Stittsville_bathroom_walkthrough.mp4` to the desktop, so the file picker is one click away.
6. Check `api/.env.local`: `LIVE_VOICE` matches what you decided above, and the ElevenLabs credits aren't used up.
7. Kill switch **off** (staff header). Check the time: after 9 PM, outbound offers are held for quiet hours. Replies to a customer's own text still go out.
8. Browser: one window, zoom 125%, bookmarks bar hidden, notifications off, laptop on power. Open the tabs in order:

| # | Tab | Why |
|---|---|---|
| 1 | `/compare` | Before (left) / after (right) |
| 2 | `/?demo=1` | Customer start (or the phone with the QR) |
| 3 | `/assess/demo-tenant` | Tenant pack, pre-loaded |
| 4 | `/hub` | Staff: three rows, approve / deny |
| 5 | `/muse` | Asper |
| 6 | `/demo-texts` | Memory + follow-ups (optional) |
| 7 | `/proof` | Evidence, if a judge asks |
| 8 | Backup video | The Devpost recording, paused at Bruce |

---

## Live pitch script (5:00)
Two people: **Talker** (faces the judges) and **Driver** (runs the laptop and never narrates). Hit each checkpoint or cut the next optional beat.

| Time | Beat | Talker says | Driver does |
|---|---|---|---|
| 0:00 | **Hook** | "Mold Busters' own video starts at 11 PM: someone finds a black patch, calls, and nobody picks up. We went through your sample jobs, and the expensive version of that story happens *after* the inspection." | Tab 1 `/compare`, left side |
| 0:20 | **Before** | "Job 1 asked one question: *where is the moisture coming from?* They got four canned texts: '10% off', 'should we close your case?'. None mentioned the leaking faucet the inspector found. Job 2, a tenant with headaches, got plumber referrals. Both estimates, **$4,779**, viewed and never accepted. That's your data, not ours." | Point at the four texts |
| 0:45 | **Customer: no app** | "So here's 11 PM with Asper. No app, no account. Five taps tell Bruce where to look…" | Tab 2 → **Go live with AI** → Laundry → In or around a vent → Next → Up to a door → A musty smell → `H2X 1Y4` → **Open camera** |
| 1:05 | **Bruce** | (Let Bruce talk. Then:) "He's coaching the camera like an inspector on the phone would: closer, more light, hold still. The customer taps the shutter. He never says 'mold', because your own reports say you can't confirm it from a photo." | Take 2 shots, then let him finish. If he stalls for more than 5 s → **Skip** each shot (demo mode shows the result with sample photos), or play tab 8 |
| 1:40 | **Value moment** | "In under two minutes: what's visible, what photos can't tell, the next service at **your** published price. The AI never writes a number. They can book, or buy the full $20 report." | Scroll the pre-assessment card |
| 1:55 | **Tenant pack** (optional) | "Job 2 was a tenant whose landlord wouldn't listen. For $50, we write to the landlord for her, from her evidence. If he ignores it, the next step is drafted on schedule. Nothing is sent without her OK." | Tab 3 → Tenant pack → show the letter → **Open in Gmail** (pre-filled) |
| 2:15 | **Staff side** ✔ checkpoint | "Now Mold Busters' side. Everything is drafted; staff approve or deny." | Tab 4 `/hub`. Point at **Virtual assessments**: the call you just did, filed with its photos and recommendation. (The booking offer sends itself once the customer leaves a phone number or email on the results page.) |
| 2:30 | **After** | "Remember Job 1? Here's her latest text: *does the estimate include fixing the faucet?* The AI drafted the answer from her inspection: the estimate covers the mold work, and the faucet is a plumbing repair. One click." | **Customer conversations** → the Kanata customer (Job 1) → **Approve**. If it isn't in the top 3, click **View more** |
| 2:50 | **On-site video** | "After a visit, the inspector uploads the walkthrough video. This is a real Mold Busters walkthrough in Stittsville. Frames, what the engineer said at each moment, the findings and the report fields fill in. We prepared this clip ahead of time; running it on any video is next." | **On-site reviews** → Upload video → pick the Stittsville file. Talk over the ~16 s animation |
| 3:15 | **Report + approve** | "Every sentence in this report cites a frame or a finding. If a check fails, say a positive swab outside the estimate's scope, the Approve button locks. Approve, and the client's email goes out by itself." | **Review & approve the report** → Approve |
| 3:35 | **Asper** | "Last one. Case 42, Laval: the seller is being threatened by the buyers. Two years ago, that's a day digging through seven tools and Telegram. Now…" | Tab 5 → click the suggestion **"I have legal issues with case 42…"** |
| 3:50 | | "A numbered brief from the record only: what was agreed, what was found, what was paid, and the lines likely to be argued, quoted word for word. Plus a ZIP with every message, photo and approval, fingerprinted so a lawyer can show nothing changed. A factual record, not legal advice." | **Download the evidence bundle** → open the ZIP → `MANIFEST.txt` |
| 4:15 | **Memory** (optional) | "And it remembers people the way a great salesperson does. The customer says they're expecting a baby. It's noted in their own words, and a personal check-in is drafted, but a person approves it. Health details never go in a message." | Tab 6 → tap the chip "expecting a baby in May" → **Draft a personal check-in** |
| 4:35 | **Close** ✔ | "AI does everything except the inspection. **Real:** everything you just saw, on your six sample jobs. **Simulated:** the actual texting and email, payments and CRM sync, and the storm alert. Inspectors inspect; Asper runs the office." | Back to tab 4 `/hub` |

**Checkpoints:** be on the Hub by **2:15** (otherwise skip the tenant pack). Start the Asper question by **3:40** (otherwise skip memory).

### 3-minute cut
Hook + Before (0:40) → Bruce + value moment (0:50) → Hub: approve the faucet answer (0:25) → On-site video + approve (0:35) → Close (0:20). Skip the tenant pack, Asper and memory; mention Asper in one sentence at the close.

---

## Devpost video (3:00 max)
Judges often watch muted. **Burn in captions**, and keep the on-screen "simulated" labels visible.

| Time | Shot | Voiceover / caption |
|---|---|---|
| 0:00-0:12 | Black screen, "11:02 PM". Cut to the real vent-grille photo from the sample pack | "It's 11 PM. There's a black patch behind the washer. You call Mold Busters. Nobody answers." |
| 0:12-0:32 | `/compare` left: Job 1's four texts. Counter animates to **$4,778.87**. Seven tool logos | "In Mold Busters' own sample jobs, both estimates were viewed and never accepted. The customer asked where the moisture was coming from. She got '10% off'." |
| 0:32-0:42 | Title card: **Asper**. "AI runs the office. People inspect." | |
| 0:42-1:25 | Screen recording: five taps → photo plan → **Bruce live** (record with real audio) → shutter → pre-assessment with price | "No app. Five taps, then Bruce, our voice agent, coaches the camera like an inspector on the phone would. He never diagnoses. Two minutes later: what's visible, what photos can't tell, and the next step at Mold Busters' real price." |
| 1:25-1:40 | Tenant pack letter → opens pre-filled in Gmail | "Tenants get a $50 pack: we write to the landlord for them, and escalate if he ignores it. Nothing goes out without their OK." |
| 1:40-2:00 | `/hub`: the call appears in Virtual assessments; Job 1's faucet question → **Approve** | "On Mold Busters' side, every case files itself. The AI drafts the reply that answers the customer's actual question. Staff approve or deny." |
| 2:00-2:22 | On-site video upload → frames and the engineer's words fill in → report with citation chips → Approve | "After a visit, upload the walkthrough. Frames, transcript, findings and a report where every sentence cites evidence." Caption: *prepared demo clip* |
| 2:22-2:40 | Asper: the case 42 legal question → brief → ZIP → `MANIFEST.txt` | "Facing a legal claim from two years ago? Asper builds the evidence file in seconds, every file fingerprinted." |
| 2:40-2:52 | `/proof`: 0/24 overclaims, 162/168, 2.3 s, 90 tests. Then the real-vs-simulated table | "Measured, not vibes. And we label what's simulated: sending, payments and CRM sync." |
| 2:52-3:00 | Hub, then the logo | "AI does everything except the inspection." |

**Recording tips**
- Record each row as its own clip (OBS, 1080p, browser at 125%). Edit them together and record the voiceover last.
- Reset (`/admin/reset`) before each take, so the counters and drafts look the same.
- Record Bruce with system audio *and* the mic. If a take stalls, re-record; don't cut mid-sentence.
- Upload to YouTube (unlisted is fine) and paste the link into `[VIDEO]` in `DEVPOST.md`.

---

## Rehearsal plan
1. **Run 1, script in hand:** time every beat, and note where the Driver waits on the screen.
2. **Run 2, with failures:** turn off Wi-Fi halfway through, and deny the camera once. Practise each fallback line out loud.
3. **Run 3, full dress:** venue-like room, a stopwatch, a teammate asking 3 questions from the Q&A list.
4. Reset between every run: `POST /admin/reset`, then `/?reset=1`.

## Fallbacks
| Failure | What to do | What to say |
|---|---|---|
| Bruce silent or stalling | Skip the shots (demo mode shows sample-photo results) or play tab 8 | "Voice is the fragile part, so the photo flow is always the backup. Here's a recorded call." |
| No AI quota / slow AI | Nothing: every step has a rule-based fallback, labelled "Template" or "rule" | "It works with no AI at all; that's on purpose." |
| Wi-Fi dead | Everything is on localhost; ElevenLabs is the only thing that needs the internet | Switch to the recorded Bruce clip |
| Tunnel / QR dead | Use the laptop with `?demo=1` | "Same page the customer gets." |
| Upload says "This demo is prepared for…" | The file name must contain "stittsville"; re-pick the right file | |
| Message shows "held: quiet hours" | It's after 9 PM | "It respects quiet hours and sends at 9 AM." |
| Data looks wrong | `POST /admin/reset` | |

## Judge Q&A
| Question | Answer (about 10 seconds) |
|---|---|
| Does it diagnose mold? | No, by design. It describes what's visible and marks areas to look at. Inspectors and lab sampling confirm. On the 24 sample photos it claimed mold 0 times. |
| Was Bruce tested on real calls? | Not yet on live audio at scale. His rules and tools are tested in code and on 8 simulated personas, and if voice fails, the photo flow takes over. Live calls on a credit budget are next. |
| Does the video step work on any video? | Not yet. This clip was transcribed and cut ahead of time with local Whisper and ffmpeg. The pieces are real scripts; running them on upload is next. |
| Is texting customers legal? | It's built around CASL: consent with an expiry per person, offers only with consent, STOP works instantly, quiet hours, at most one marketing message a week, and a kill switch. Sending is simulated until Twilio is connected. |
| Do customers know it's AI? | Bruce introduces himself as Mold Busters' AI photo coach and says the call is recorded. Texting HUMAN always gets a person. |
| Isn't remembering family details creepy? | Family facts are for people: they become talking points or drafts a person approves, never automatic texts. Health is never used in messages. Children are stored only coarsely. |
| What if the AI is wrong? | Every claim cites a photo, finding or quote. Anything with money or personal facts needs a person. Reports can't be approved with a blocking check open. |
| How does it fit our 7 tools? | FreshBooks and Calendar stay. Report PDF and FreshBooks CSV today, two-way sync next. What it replaces is the Close sequences, Asana cards, Brain notes and Telegram re-typing. |
| What does it cost to run? | The demo runs on free models. At paid rates, a few cents per case. SMS is about a cent per text. |
| How much time does it save? | Not measured with your staff yet. Job 1's report took an 82-minute window and arrived 45 hours after the visit; here the draft takes seconds and a person reviews it. |
| Quebec / French? | French intake, French drafts for French speakers, Québec tax, the TAL in the tenant pack, and a French privacy page. |
| Customers outside Canada? | They're routed to the $20 remote AI report. Your Philadelphia sample job shows the demand is already there. |
