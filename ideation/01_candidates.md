# Round 1 output: 15 candidate ideas (deduped from 4 ideators: Customer, Ops, Revenue, Moonshot)

A. **11 PM Intake Agent ("Moldy")** - realtime voice (OpenAI Realtime/Vapi+Twilio) + chat fallback answers after-hours, explains ERMI 13.2, quotes real prices ($195+HST on-site / $100 virtual), books slot, writes mock Calendar event + Close lead, sends survey SMS. Wow: Michael calls it live on his phone. Risk: health-advice liability, voice latency. Ideators guessed U8-9/W8-9/P7-8.

B. **Virtual Inspection Copilot** - replay Job 2 Walkthrough_Silent.mp4 as "live call"; SAM2 (in-browser ONNX/WebGPU) click-to-segment + VLM frame tagging masks discoloration, auto-suggests snapshots (beyond the 3 manual), rolling transcript of inspector narration, report draft fills in before call ends with "possibly fungal, cannot confirm without sampling". Wow: report done before hang-up. Risk: SAM2 setup time, low-res video. Guess U7-9/W8/P7-8.

C. **Pre-Visit Concierge** - replaces static Google Form; SMS-style agent requests photos, VLM annotates, asks tenant/health questions, produces inspector brief before call (Job 2 learned tenant+health only mid-call). Guess U8/W8/P8.

D. **Deal Rescue / Concern-Aware Closer** - replaces 4 canned Close SMS ("10% off", "close your case?") and 6 generic Marketplace emails with agent grounded in job concern+findings+estimate: answers "where is it coming from?", ERMI, scope, deposit, expiry (Dec 6), escalates to human with summary. Multi-turn, judge texts it live. Guess U8-9/W8-9/P8-9.

E. **Ask-My-Report / Estimate Concierge page** - interactive link in report email: customer asks questions, answers cite exact finding + photo, plain-English scope, validity countdown, buying-signal alerts to staff. Guess U7-8/W9/P7-8.

F. **Report Ghost** - 21 photos + inspector shorthand notes -> VLM captions -> draft report in Report_OnSite_Sample structure, every sentence linked to photo; second-LLM reviewer flags unsupported claims; diff vs reference. Before 82 min wall-clock, after <1 min draft + 10-15 min review; ~$0.10-0.30/report. Guess U8/W8/P8.

G. **Source of Truth conflict detector** - ingests timelines/mock exports from 7 systems, flags Oct1 vs Sept5, Staff A booker+inspector, Asana closed vs Close "Potential", proposes reconciliations w/ confidence. Guess U7/W9/P9. Risk: thin with 2 jobs.

H. **Revenue Leak Radar / Next-Step Autopilot** - pipeline dashboard w/ timeline scrubber replaying Oct 1-22; SLA rules (human touch <=48h after estimate viewed) fire alerts; $-at-risk counter ($4,779); trigger-condition automation builder for email/SMS; drafts next action. Guess U7-9/W7-9/P8-9.

I. **New-Hire Training Copilot** - RAG over SOP from job stories; quiz/simulation mode graded vs real timeline. Guess U6/W8/P8.

J. **Finance Reconciler** - tax by province (13% ON, 14.975% QC), deposit math, estimate expiry vs follow-up stopping 48 days early, seeded-error catch. Guess U6/W9/P9. Best as component.

K. **Tenant vs Homeowner Segmentation** - tenant track: landlord-forwardable letter citing findings, landlord outreach variant, re-priced entry offer; homeowner track: deposit/financing. Guess U7/W7/P8. Risk: Quebec tenancy legal phrasing.

L. **Referral Revenue Engine** - turn report recommendations (insulation co., roofer, vent cleaning) into tracked partner referrals; fix review ask (Google review not app-store). Guess U7/W8/P8.

M. **AI Office Manager (multi-agent)** - digital-twin pipeline across 7 tool lanes; auditor/drafter/Q&A sub-agents; "what's blocking revenue?" in plain English; one-click approve fixes; TTS narration. Guess U8/W9/P8.

N. **Personalized Video Explainer** - 60s narrated video from customer's own photos w/ SAM2/VLM overlays + estimate scope (TTS + Remotion/FFmpeg, optional HeyGen avatar); tenant version for landlord. Guess U7/W9/P8.

O. **Phone Scan -> Instant Ballpark Estimate** (team's original idea) - customer scans room w/ phone; SAM2/VLM flags suspected areas + approximate affected area; rules-based pricing engine modeled on EST-CASE01 structure (areas x containment x treatment steps x clearance + provincial tax) gives range; compiles photo dossier; routes to booking. Concern: can't diagnose visually, can't train ML on 2 jobs, area estimation from phone video is rough.
