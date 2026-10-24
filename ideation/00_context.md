# Shared Context: Mold Busters AI-Native Hackathon

## The prompt
Mold Busters (Ottawa/Quebec home-services mold inspection & remediation company, 20+ yrs) wants to become "AI-native".
Open to the whole business: customer service, scheduling, sales, reports, training, finance. Build ONE useful working AI solution.
Their vision video: customer finds mold at 11 PM, calls, nobody answers, problem gets worse. They imagine AI agents, virtual inspections, instant answers.

Judging (30 pts): Useful 10 (saves time/cost/improves service), Working 10 (demo it doing the job), Practical 10 (could MB realistically use it).
Must show one before-and-after example. Be clear about what works vs simulated. Ties -> higher usefulness.
Judge "Michael" is non-technical and a huge AI fan.

## Dataset (at /Users/shrey/Downloads/Coding/soonHacks/Mold-Busters-Hackathon-Sample-Pack-v2/)
- 00_START_HERE.pdf, README.txt
- 01_OnSite_Sample/: Job_Story.pdf, job_timeline.json, Report_OnSite_Sample.pdf, 21 photos (thermal, swabs, washroom discoloration, attic insulation, exterior drainage)
- 02_Virtual_Sample/: Job_Story.pdf, job_timeline.json, Report_Virtual_Sample.pdf, 3 photos (discoloration dryer vent hose, ceiling vent, vent grille), Videos/Walkthrough_Silent.mp4 (2m56s low-res)
Organizer warnings: 2 cases are NOT a training set or accuracy benchmark. Source records disagree; flag mismatches, don't invent facts. Elapsed time != labor time. No live API access. Keep reference reports out of test inputs when evaluating report generation.
Organizer suggestions: connect job timeline & flag missing next steps; draft report with evidence links to photos; detect conflicting appointment times/staff/booking notes; improve follow-up using actual stage & unanswered questions.

## Job 1 (on-site, Ontario house, homeowner)
Concern: basement efflorescence-looking thing, home ERMI test score 13.2, wants size & source. Paid $195+HST.
Timeline: booked Oct 1 (note says booked Sept 5 - inconsistency) via Google Calendar; inspection Oct 6 (thermal, moisture, swabs, attic, exterior, 21 photos); Oct 7 FreshBooks invoice + estimate $3,700+HST; Oct 7 12:42-14:04 admin writes report in "Brain" internal CRM from inspector notes, 2nd admin reviews; Asana card auto-created; Oct 8 09:05 report emailed; Oct 9-19 Close CRM 4 canned SMS ("I sent the estimate...", "10% off", "checking in one last time", "still interested or close your case?"); Oct 22 manual Dialpad SMS, card closed. Status: estimate viewed, NOT accepted. Staff assignment mismatches across records (Staff A listed as booker AND inspector; Staff B as estimator).
Findings: basement small discoloration under sink swab positive, otherwise normal; thermal anomalies top floor, living room below roof, laundry ceiling; upstairs washrooms grout/silicone discoloration, standing water, failed ball-slope test, leaking tub faucet high moisture; attic insulation disturbed + discoloration; exterior poor drainage + depression at entrance.
Estimate: $3,700 + 13% HST = $4,181; 1 day; washrooms + attic; containment, HEPA, stain removal + eco fungicide, fogging, clearance 3 swabs; 40% deposit, valid 60 days.

## Job 2 (virtual, Quebec apartment, tenant)
Self-booked online Sept 7 2025, form: black/white mold in washer, around washer/dryer, vents, oven, persistent smell. Calendar event auto-gets AI "financial analysis" of the area. Confirmation email + SMS with pre-inspection Google Form survey. Close lead auto-created.
Sep 8 11:30 ~19 min video call on vr.bustmold.com app; client walks camera 4:12-7:08; inspector takes 3 snapshots. $100 paid. Report written 12:48-13:00 by admin, reviewed, sent 13:00 (~1.5h after call). SMS asks to rate app. Sep 12-27: 6 generic "MB Marketplace" emails (referrals to plumbers etc.).
Findings: health issues, musty odor, visible discoloration possibly fungal but can't confirm without sampling. Recommend doctor, IAQ test, limit time in area.
Estimate: IAQ test $520 + 14.975% = $597.87. Viewed, NOT accepted.

## Systems in use
Google Calendar, FreshBooks (invoices/estimates), Asana (job cards), Close CRM (leads, SMS/email sequences, "Bruce" virtual support), Brain (internal CRM, report writing), Dialpad (SMS/calls), support email, vr.bustmold.com virtual inspection app.

## Key observations already made
- Both jobs lost at "estimate viewed, not accepted" -> conversion leak is the biggest $ problem.
- Follow-up is generic, ignores actual concerns (ERMI, source question, tenant health/landlord issue).
- Report writing is manual (~82 min wall-clock for job 1).
- ~7 fragmented systems with conflicting records.
- Team's initial idea: custom YOLOv8 or SAM (Segment Anything) mold detection in phone livestream, rough pricing, PDF/report reading, pipeline dashboard, email automation with trigger conditions. Concern: 24 photos can't train YOLO; can't diagnose mold visually (liability); pricing must be rules-based from their estimate structure, not ML on 2 jobs. VLM + SAM2 in browser is the feasible "wow".
