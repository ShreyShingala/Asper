# 2. How we decided what to build

We didn't pick the first idea. Every major step went through AI agents arguing for and against it, then a revision. The point was to find what's actually useful to Mold Busters, not what's most impressive to build.

## Stage 1: the starting idea, and why we dropped it
**Team's first idea:** train YOLO / Segment Anything to detect mold in a phone livestream, price the job, generate reports, add a pipeline dashboard and email automation.

**Why it didn't survive:**
- 24 photos can't train a detector. The organizers say the two jobs are "not a training set or an accuracy benchmark".
- Diagnosing mold from a picture is a liability. The sample reports say discoloration "might resemble something fungal" but can't be confirmed without sampling and lab analysis.
- Pricing from 2 jobs isn't machine learning; it has to come from Mold Busters' own price list.

**What we kept:** vision as an *evidence assistant*. It describes what's visible and marks "areas worth a closer look", never "mold".

## Stage 2: 10 ideas, debated by agents (`ideation/FINAL_10_IDEAS.md`)
| Round | Agents | Output |
|---|---|---|
| Ideation | 4 ideators: customer journey, back office, revenue/sales, moonshot AI | 20 ideas, merged to 15 |
| Critique | 3 critics: **Michael (owner persona)**, **skeptical engineer**, **front-line staff panel** | Scores and objections on every idea, 3 new ideas |
| Rebuttal | 1 advocate defended the marked-down ideas, conceded the rest | Final ranked top 10 |

**The top three:**

| Rank | Idea | Score /30 |
|---|---|---|
| 1 | **The Closer**: concern-aware deal rescue | 27 |
| 2 | **Report Ghost**: evidence-linked report drafting | 26 |
| 3 | **11 PM Moldy**: after-hours intake | 25 |

All three critics ranked the Closer first ("this is THE leak").

## Stage 3: the owner's feedback, and Bruce
Michael's direct feedback (`ideation/03_bruce_v2.md`) shifted the centre:
- an AI in the browser, with no app;
- a report and estimate right away;
- global reach and a $25 remote report.

We named the assistant **Bruce**, after the virtual-support persona Mold Busters already uses in Close CRM.

## Stage 4: one product instead of a bundle: MoldFlow
Rather than six separate tools, we combined the best ideas into **one continuous case**, the **Evidence Passport**, that all six stages read and write:
1. AI pre-assessment (photos or a live Bruce call)
2. Guided browser camera walkthrough
3. Next-step routing (virtual / on-site / air quality test / remote report)
4. Inspector evidence (field notes → findings, quick-tap readings)
5. Report + estimate drafted, checked and approved by a person
6. Quote, booking and follow-up that answers the customer's real question

Line used in the pitch: *"One case. From first concern to confirmed next step."*

## Stage 5: red-teaming the build plan (`plan/REDTEAM_LOG.md`)
| Round | Reviewers | What it forced |
|---|---|---|
| 1 | 4 hostile reviewers: **Judge/Rubric**, **Build feasibility**, **Honesty/Data/Liability**, **Users/UX/Demo** | about 45 attacks, most accepted |
| 2 | **Pre-mortem**: "the demo failed and we lost. Why?" | about 10 fixes (gates, missing endpoints, a demo cut-down) |

Changes forced by round 1:
- The customer gets value first: a pre-assessment card and a PDF.
- "Lost" became "not accepted".
- Only Mold Busters' published prices are shown, and the reference reports are never fed to the AI.
- The health answer is fixed in code.
- Every AI output carries a "Live AI" or "Replayed" label.
- A script that runs the whole demo through the API, and works offline.

## Stage 6: measuring instead of guessing (`plan/OVERNIGHT_LOG.md`)
The photo AI and Bruce were improved in measure → change one thing → re-measure → keep-or-revert cycles. A change was kept only if the score went up and nothing got worse. One prompt version (Bruce v4) scored higher but was **rejected**: a new check caught it saving an answer the customer never gave. Results are in [05_evidence.md](05_evidence.md).

## Stage 7: the Hub, red-teamed by four subagents (`plan/HUB_PLAN.md`)
The next ask was the full back office:
- Rockefeller-style memory of each customer;
- flood alerts that reach out to people in the affected area;
- SMS and email;
- mold research;
- one dashboard instead of seven tools.

Four subagents attacked the plan before any code was written:

| Reviewer | Biggest attack | What changed |
|---|---|---|
| **Owner value** | The flood loop is charming but small money; the proven leak is unaccepted estimates and unanswered inbound | New hero loop: an instant 11 PM answer → rescue Job 1's $4,181 estimate by answering the customer's question → memory → flood check-ins as the closing flourish. The hub leads with money. |
| **Privacy / law** | A flood "check-in" with a booking link is a commercial message under CASL; consent must be recorded, never assumed | Two kinds of check-in (safety-only vs with an offer), consent basis and expiry per channel, an unchecked consent box, a profiling notice, opt-out keywords, the recording disclosure |
| **Engineering** | Hidden traps in the existing code (no shared clock, duplicate message models, reset only wiping cases, a 2× time underestimate) | A shared time-travel clock; one message outbox; a reset that covers everything; a gate (no extra screens before the core loop passes offline) |
| **Staff adoption** | Approval fatigue, phone-first customers, a 7th inbox instead of 1, creepy "how's the baby?" scripts | Batch approve; anything with $ or personal facts locked to a person; take-over / hand-back; global search; talking points written as natural scripts with where each came from; household facts as human talking points only |

**Rejected attacks**, kept on record:
- "Drop personal facts entirely". Rejected: with opt-in, coarse storage and talking points first, they're useful and lawful.
- "Real Twilio now". Deferred until keys are available.
- "News scraping for floods". Deferred: official Environment Canada alerts are reliable and free.

## The principle running through all of it
**Useful beats impressive.** Every feature has to save staff time, recover revenue or serve the customer better, and it has to be honest about what is real.
