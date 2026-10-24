# 8. Demo script (about 6 minutes, with a 4-minute cut)

**Goal:** show the AI doing the job end to end, show one before/after with Mold Busters' own data, and be explicit about what's real.

## Setup (T-30 min)
1. `scripts/dev.sh prod` (or API on :8000 + `npx next start`), then `curl -X POST localhost:8000/admin/reset`.
2. `cd moldflow/api && uv run python ../scripts/demo_api_run.py` must print `DEMO PATH PASSED` (it resets data at the start). Then reset again.
3. `scripts/tunnel.sh` for a phone; open `/try` for the QR code.
4. Tabs: `/hub`, `/people/c-job1`, `/outreach`, `/alerts`, `/compare`, `/cases/job1/review`, `/proof`. Projector zoom 125%.
5. If Bruce is used: the ElevenLabs key is set and `setup_elevenlabs_agent.py` was re-run (so the recording disclosure is live).

## Script
| Time | Beat | Say | Do |
|---|---|---|---|
| 0:00 | **Before** | "In both sample jobs the estimate was sent, viewed and never accepted: $4,779. The follow-up was four canned texts: '10% off', 'should we close your case?'. Nobody answered the customer's actual question." | Show `/compare` (left side) |
| 0:40 | **11 PM** | "It's 11 PM. Someone finds black stuff on their basement wall and texts. Today: voicemail." | `/hub` → Demo controls → **Send text**. The status line shows "reply sent instantly". |
| 1:00 | | "Instant answer. It won't give medical advice; it offers the right test. It created the contact, and it noticed the asthma mention but is holding it for a person to check: health details never go into marketing." | Open the new person from Inbound |
| 1:30 | **Customer side** (optional) | "Or the customer shows us: no app. Bruce asks one question at a time and takes the photos himself." | Phone: `/assess` live, or the upload flow with sample photos → pre-assessment card |
| 2:15 | **The rescue** | "Back to the real Job 1: $4,181, viewed 17 days ago." | `/hub` → Money on the table → **Draft follow-up** on Sample Client 01 |
| 2:30 | | "It read the inspection: the likely moisture source is the upstairs washrooms, a shower floor that fails the slope test, not the basement spot they worried about. It answers their question and the price holds until Dec 6. Anything with a dollar amount always needs a person: see the button." | `/outreach` → show the draft → **Approve & send ($4,181.00)** |
| 3:00 | **The reply** | "The customer says yes, and mentions they're expecting a baby." | Trigger the reply (Demo controls with Job 1's number `(613) 555-0110` and the text "ok let's do it, also we're expecting a baby in March", or the API) |
| 3:20 | | "Accepted: $4,181 recovered, and the crew-scheduling task is created. It learned something about her life, with her exact words and where she said it. A person approves it. Because it's about her family, it becomes a talking point for a call in February, never an automated text." | `/people/c-job1` → approve the fact → Coming up shows the nursery check "for a person to bring up" |
| 4:00 | **One place** | "Everything about her from Calendar, FreshBooks, Asana, Close, Dialpad and email, on one timeline, with talking points for the next call." | Scroll the timeline; point at the source chips |
| 4:30 | **Flourish: weather** | "And when Environment Canada issues a rainfall warning over Gatineau…" | `/alerts` → **Simulate rainfall warning** → **Draft check-ins** |
| 4:50 | | "Nine past customers there. The ones who asked for storm check-ins come first. An offer goes only to people who agreed to receive offers; everyone else gets a safety message with no sales pitch. That's Canada's anti-spam law, in code. French speakers get French." | `/outreach` → **Approve all without money** |
| 5:20 | **Close** | "AI does everything except the inspection. Real: everything you saw. Simulated: the actual sending, payments and CRM sync, and the demo customers are labelled synthetic." | `/hub`: recovered $4,181; chased → replied → accepted 1 → 1 → 1 |

**4-minute cut:** skip the customer side (1:30) and the timeline (4:00); state the weather beat in one line.

## Fallbacks
| Failure | Fallback |
|---|---|
| No AI quota / slow AI | Nothing to do: every hub step has a reviewed template; photo analysis falls back to fixtures |
| Tunnel/QR dead | Laptop localhost ("same page the customer gets") |
| Camera denied / Bruce down | The upload flow; "Use sample photos" |
| A message shows "held: quiet hours" (demo after 9 PM) | Say "it respects quiet hours and sends at 9 AM", or time-travel (`POST /admin/clock`) |
| Data in a weird state | `POST /admin/reset` (reseeds everything) |

## Judge Q&A
| Question | Answer (10 seconds) |
|---|---|
| Does it diagnose mold? | No, by design. It flags areas to look at and gathers evidence; inspectors and lab sampling confirm. On the 24 sample photos it claimed mold 0 times. |
| Isn't remembering family details creepy? | It's for people, not robots. Family facts become talking points on calls, never automated texts; children are stored only as "school-age child"; health is never used in messages; customers can see, fix or delete it, and must opt in to personalised reminders. |
| Is texting people legal? | It's built around CASL: consent with an expiry per person, offers only with consent, STOP works instantly, a footer on every message, quiet hours, a cap of one marketing message a week. |
| How does it fit our 7 tools? | One timeline over all of them. FreshBooks and Calendar stay; Close sequences, Asana cards and Brain notes get replaced. Exports today; APIs next. |
| What if the AI is wrong? | Every claim cites a photo, reading or quote; anything with money or personal facts needs a person; there's a kill switch; the proof page shows where it slipped. |
| What does it cost? | The demo runs on free models. At paid rates, cents per case. Twilio SMS is about a cent per text. |
| Was this measured? | Photo AI 140 → 162/168 and Bruce 33/44 → 85/88 (simulated personas), with 80 unit tests and 19 browser tests. Conversion lift is projected, not measured. |
| Quebec / French? | French drafts for French speakers, QC tax, a French privacy page. Full Bill 96 coverage is a production item. |
| Global? | Out of area → $25 remote report; partner referrals on the roadmap. |
