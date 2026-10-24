# 1. The problem

## What Mold Busters asked for
A 20-year Ottawa/Quebec mold inspection and remediation company wants to become "AI-native" across the whole business. Their vision video starts with a customer who finds mold at 11 PM, calls, nobody answers, and the problem gets worse.

Judging: **Useful 10 / Working 10 / Practical 10**; show one before/after; be clear about what works vs what is simulated; ties go to Useful. The judge, Michael (the owner), is non-technical and a big AI fan.

## What the two sample jobs show (from the sample pack)
| | Job 1: on-site, Ontario house, homeowner | Job 2: virtual, Quebec apartment, tenant |
|---|---|---|
| Customer's concern | Basement spot, a home ERMI test scored **13.2**, "how big is it and where is it coming from?" | Black/white growth around washer, dryer, vents; persistent smell; **health issues** |
| What they paid | $195 + HST inspection | $100 virtual assessment |
| Estimate | **$3,700 + 13% HST = $4,181**, valid 60 days (to Dec 6) | Air quality test **$520 + 14.975% = $597.87** |
| Outcome | Estimate **viewed, not accepted** | Estimate **viewed, not accepted** |
| Follow-up they got | 4 canned Close texts ("I sent you the estimate", "10% off", "checking in one last time", "should we close your case?") + 1 manual Dialpad text on Oct 22, then the card was closed | 6 generic "MB Marketplace" emails (plumber referrals); nothing for their landlord |

**Combined: $4,778.87 in estimates sent, viewed and not accepted.** We say "not accepted", never "lost": we don't know why they didn't buy.

## The five problems we took from that
1. **The conversion leak is the biggest dollar problem.** Both jobs stalled at "estimate viewed". Job 1's follow-up stopped about 15 days into a 60-day estimate, so about 45 days of a valid $4,181 quote went untouched.
2. **Follow-up ignored what the customer asked.** Job 1 asked about the ERMI score and the *source*. The texts offered "10% off". The inspection had found the likely moisture sources (a shower floor that failed the ball-slope test, a leaking tub faucet), but no message mentioned them. Job 2 was a tenant with health symptoms and got plumber referrals.
3. **Evidence arrives without context, and reports take time.**
   - Customers email photos without saying where the spot is, what's above it, or whether there's a leak, and the inspector has to ask.
   - Job 1's report was written and reviewed in an **82-minute window by two admins** (elapsed time, not measured labour).
   - It was emailed **45 h 35 min after the inspection** (elapsed turnaround).
4. **Seven tools, conflicting records.** One customer is spread across Google Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email. The records disagree: the booking was created Oct 1, but its note says Sept 5, and Staff A is listed as both booker and inspector.
5. **Nobody answers at 11 PM.** That's the owner's own scene. And the virtual inspection requires installing an app and registering a phone number first.

## What the owner told us directly (pre-hackathon call, not in the dataset)
- Customers find them through Google or ChatGPT, then email photos and videos that lack context.
- The virtual inspection needs an app plus a phone number, a live inspector, a report that takes "a couple of hours", then an estimate, then follow-up: "a real long process".
- He wants an AI in the browser that asks the right questions and produces the report and estimate right away.
- He also wants global reach (anyone, anywhere; a paid $25 report outside the service area) and "something I didn't think of".

## What this means for a solution
- The highest-value fixes are **follow-up that answers the real question**, **instant first response**, and **one place for the whole customer**, ahead of any "AI detects mold" feature.
- The solution must never claim to diagnose mold from a photo: that's a liability problem, and the sample reports themselves say mold can't be confirmed without sampling.
- It has to fit their tools (FreshBooks and Calendar stay; exports drop into them) and keep humans approving anything risky.

See [04_decisions.md](04_decisions.md) for how each of these became a design decision.
