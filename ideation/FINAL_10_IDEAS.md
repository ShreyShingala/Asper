# Mold Busters Hackathon: Top 10 Ideas (Multi-Agent Debate Output)

## How this was produced
| Round | Agents | Output |
|---|---|---|
| 1. Ideation | 4 ideators: Customer journey, Back-office ops, Revenue/sales, Moonshot AI | 20 ideas, merged to 15 (A-O); your scan-to-estimate idea added as O |
| 2. Critique | 3 critics: **Michael** (owner persona), **Skeptical engineer**, **MB front-line staff panel** | For/against + scores on every idea, 3 new ideas (P-R), list of traps |
| 3. Rebuttal | 1 advocate defended the ideas the critics marked down, reframed them, conceded the rest | Final ranked slate |

Raw files: `00_context.md`, `01_candidates.md`, `02_critiques.md`.

Scores are U/W/P = Useful / Working / Practical (out of 10 each, 30 total), as agreed after the debate.

---

## Facts every idea uses (from the dataset)
- **Both jobs died at "estimate viewed, not accepted":** $4,181 remediation plus $597.87 air-quality test = **$4,779 lost**.
- Job 1 follow-up was 4 canned texts ("10% off", "should we close your case?") followed by one manual text on Oct 22, so it stopped about **15 days into a 60-day estimate** (valid until about Dec 6). That left **about 45 days of a valid $4,181 estimate untouched.**
- None of the follow-ups answered what the customer actually asked: ERMI 13.2, "how big is it, and where is it coming from?"
- Job 2 was a **tenant** with health symptoms. They got 6 generic "Marketplace" emails about plumbers, and nothing they could forward to their landlord.
- Report writing: an **82-minute wall-clock window** (Oct 7, 12:42-14:04) across 2 admins. This is elapsed time, not measured labour.
- The records disagree: the booking was created Oct 1 but its note says Sept 5, and Staff A is listed as both booker and inspector.

---

## The 10 ideas (ranked)

### 1. The Closer: concern-aware deal rescue agent (27/30, 9/9/9)
**Components:** D Deal Rescue + K tenant track + R expiry watchdog + P payment-gate explainer
**Pitch:** Replaces the canned texts and emails with an agent that reads the job file (concern, findings, estimate) and answers the customer's actual questions. Tenants get a different path. It revives estimates that are still valid, and staff approve messages before they go out.
- **Before → after:** "Checking in one last time… still interested or should we close your case?" becomes "Your ERMI of 13.2 is moderate. The basement swab was small. The likely source is the failed shower slope and leaking tub faucet upstairs, which the estimate covers. Your price holds until Dec 6."
- **Wow:** Michael texts it live ("is this dangerous for my kids?") and gets a safe, grounded answer that pushes toward booking.
- **Build:** 10-14h. **Real:** the AI conversation, triggers, expiry math, landlord letter. **Simulated:** sending SMS and writing to Close.
- **Risk:** the AI states something that isn't in the job file. **Mitigation:** answers come only from the job's findings and estimate; health questions always go to "consult a doctor / book an IAQ test"; only documented discounts; approve-before-send mode.
- **Critics:** #1 for Michael, #1 for the engineer (best impact for the risk), #1 for staff ("this is THE leak").

### 2. Report Ghost + Truck Mic (26/30, 8/9/9)
**Components:** F Report Ghost + Q field voice notes
**Pitch:** The inspector records 90 seconds of voice notes in the truck. The AI captions all 21 photos and drafts the report in Mold Busters' format, with every sentence linked to a source photo. A second AI pass flags any claim that isn't supported.
- **Before → after:** 82-minute wall-clock drafting window becomes a draft in under 1 minute plus about 15 minutes of review, at roughly $0.20 per report.
- **Wow:** the report builds itself on screen. Click any sentence and the photo it came from appears. Then show a side-by-side diff against the real reference report.
- **Build:** 10-14h. **Real:** photo captioning, drafting, the checker, the diff. **Simulated:** writing into Brain; the voice note may be pre-recorded.
- **Risk:** the AI mislabels a photo (a thermal anomaly is not mold). **Mitigation:** "inspector confirms" checkboxes and uncertainty labels. **Keep the reference report out of the AI's input.**
- **Critics:** Michael's #2 ("boring that makes money is my favourite kind"); staff C/D's own 82 minutes.

### 3. 11 PM Moldy: after-hours voice intake (25/30, 9/8/8)
**Components:** A intake agent + C pre-visit concierge
**Pitch:** Their vision video, built for real. A branded web voice page (with a chat fallback) answers at 11 PM, explains the ERMI score, quotes only the real prices ($195 + HST on-site, $100 virtual), books a slot, sends the pre-inspection survey and collects photos, and creates an inspector brief plus a CRM lead.
- **Before → after:** 11 PM call → voicemail → lost lead becomes answered, qualified and booked in about 4 minutes, with the inspector briefed before the call. In Job 2, the inspector only learned "tenant with health issues" partway through the call.
- **Wow:** Michael talks to it live from the judging table.
- **Build:** 10-14h. **Real:** the voice conversation, booking logic, grounded answers. **Simulated:** writing to Calendar and Close.
- **Risk:** telephony or latency failing on stage. **Mitigation:** web voice (OpenAI Realtime in the browser), not Twilio; push-to-talk plus a chat button as fallback. French support is a bonus for Quebec.

### 4. Revenue Room: pipeline replay plus alerts (25/30, 8/8/9)
**Components:** H leak radar + R expiry + J finance checks + G conflict flags
**Pitch:** A timeline slider replays Oct 1-22. A counter shows **$4,779 at risk**. An alert fires when there's been no human contact within 48 hours of the estimate being viewed. Conflicts are flagged (Oct 1 vs Sept 5, Staff A in two roles). Every alert comes with a ready-to-send next action drafted.
- **Wow:** drag the slider and watch the estimate's expiry countdown run on long after the follow-up sequence stopped.
- **Build:** 12-16h. **Risk:** "pretty spreadsheet". **Mitigation:** every alert has to produce a real drafted action.
- **Critics:** Michael said it's weak on its own but a killer product combined with #1.

### 5. Self-Writing Virtual Inspection (24/30, 8/8/8)
**Components:** B inspection copilot + F report draft
**Pitch:** The Job 2 walkthrough video replays as if it were a live call. SAM2 outlines the discoloration and the vision AI tags each frame. It suggests snapshots beyond the 3 the inspector took by hand, and the report is drafted by the time the call ends.
- **Wow:** the inspector clicks a frame, an outline appears around the discoloration, and a sentence lands in the report.
- **Build:** 14-20h. **Real:** the frame tags, the outlines (computed ahead of time), the draft. **Simulated:** the "live" call is a replay.
- **Risk:** in-browser SAM2 / WebGPU failing, or the video being too low-res. **Mitigation:** compute the outlines offline ahead of time and only use live clicking as a bonus.
- **Staff pushback:** Job 2's report already only took 12 minutes, so usefulness is limited unless this is framed as the vision front end for #2.

### 6. Ask-My-Report: interactive report and estimate page (24/30, 7/9/8)
**Components:** E + J
**Pitch:** A link in the report email. The customer asks "why $3,700?" or "do I need the attic work?" and each answer cites the exact finding and shows the photo. It also has a plain-English scope, an expiry countdown, and alerts staff when the customer shows buying interest.
- **Build:** 6-8h, the lowest risk on the list. **Risk:** the customer has to click the link. **Mitigation:** #1 sends the link.

### 7. Personalized Explainer Video (23/30, 7/9/7)
**Components:** N, pre-rendered
**Pitch:** A 60-second narrated video made from the customer's own photos: "your attic, your washroom, here's what $3,700 fixes." There's also a version for the tenant to send to the landlord. Built with Remotion/FFmpeg and AI voiceover.
- **Build:** 6-10h, pre-rendered so it can't fail on stage. **Critics:** not enough on its own; best as the thing #1 sends.

### 8. "The Office, One Question" (23/30, 7/8/8)
**Components:** M = G + J + R + narrator
**Pitch:** A dashboard with a lane for each of the 7 tools and a plain-English question box: "What's blocking revenue?" It answers with "$4,181 expires in 45 days with no follow-up; Staff A can't be both booker and inspector; …", and every claim traces back to a real record.
- **Risk:** the engineer and staff both warned it could be "agents in a trenchcoat" (a fake multi-agent demo). **Only build it on top of working pieces from #1 and #4.**

### 9. Never Lose a Lead: full-journey combo (big swing, ~24/30 if it lands, 9/7/8)
**Components:** A + C + D (+ F)
**Pitch:** One continuous demo: 11 PM call → booked → photos before the visit → report draft → the Closer revives the estimate. This is the "AI-native company" story Michael said he wants.
- **Build:** 25h+. This is #3 and #1 joined together. **Risk:** spreading the build too thin; three half-working pieces score worse than one solid one. **Only attempt it with 3+ builders.**

### 10. Photo Triage Dossier: your original idea, reframed (20/30, 7/7/6)
**Components:** O (reframed) + C
**Pitch:** The customer uploads 3-5 photos (not a live scan). The vision AI places the affected area in a **size bucket** (<1 / 1-3 / >3 m², using a reference object like a sheet of paper). A **rules engine** built on the structure of the real $3,700 estimate gives a **price range**. Output is a photo dossier with a "Book a $195 inspection to confirm" button.
- **Why it ranks last:** all three critics flagged liability ("the app said $2k, you said $4k"); 24 photos can't train YOLO; a phone video has no scale reference for measuring area. Staff called it a "liability landmine".
- **If you still want the vision wow,** put it into #5 or use it as the photo step in #3. Don't lead with it.

---

## Final recommendation
**Build #1, The Closer.** It goes after the biggest real number in the dataset, it's the safest build (no vision pipeline, no telephony), staff would actually use it, and Michael gets to take part in the demo himself.

**Extra layers to add if there's time, in order:**
1. Open the pitch with the expiry line: *"Your follow-up stopped on day 15 of a 60-day, $4,181 estimate."*
2. #7 pre-rendered explainer video as what the Closer sends.
3. #6 citation page (6-8h, cheap gain on Working).
4. With a 3rd builder: #3's web voice intake on the front end, which turns it into #9.

## Traps all critics agreed on
- No phone calls or SMS depending on live services during the demo; simulate them in the browser.
- In-browser SAM2 is never the only path; compute results ahead of time.
- Never claim a "trained mold detector" (24 photos is not a training set).
- Always say "possibly fungal; cannot confirm without sampling" (their own report wording).
- Only use documented prices and discounts ($195 + HST, $100, $3,700 + HST, $520 + tax, 10% off).
- Reference reports are only for comparing afterwards, never AI input.
- Say "82-minute wall-clock window", not "82 minutes of labour".
- Health questions only get "consult a doctor / book an IAQ test".
- Tenant letters cite findings only and are labelled as not legal advice.
- Clearly label what is measured, what is projected and what is simulated, and include AI cost per job.
