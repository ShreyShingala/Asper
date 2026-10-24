# 11. Build journal

A chronological record of what was built and why, taken from the git history (times are commit times, Oct 24). Useful for a "how we got here" slide and for judges who ask how much was built.

| Time | Commit | What | Why |
|---|---|---|---|
| 00:15 | `9f5a731` | Ideation docs, sample pack, vision spike | Multi-agent debate over 10 ideas; tested whether the free vision model could describe the sample photos |
| 00:51 | `e54da0d` | The red-teamed MoldFlow build plan | v1 → 4 hostile reviewers → v2 → pre-mortem → final plan (`plan/PLAN.md`) |
| 01:02 | `8eb5158` | API: Evidence Passport, Pydantic agents, rules, checks, exports | One case record for all stages; deterministic pricing and checks; the report PDF and FreshBooks-shaped CSV |
| 01:25 | `2f137de` | Web app, proof evaluation, reliability fixes | Customer pre-assessment, inspector, review, inbox, before/after, proof page; the first photo evaluation caught 4 photos where the AI stated mold as fact, which the prompt then fixed |
| 01:29 | `9ab74fd`, `68b443d` | Run scripts, runbook, AGENTS.md, French polish, offline fixtures | The demo has to survive bad wifi and a French-speaking judge |
| 02:16 | `7311b0d` (Lucas) | The Bruce design system across the UI | A consistent, accessible look |
| 03:20 | `218b7f2` (Lucas) | Live camera + voice pre-assessment with an ElevenLabs agent | The owner's "AI in the browser, no app" vision |
| 03:33 | `8b2420c` (Lucas) | Accessible orange theme + on-site booking | WCAG AA contrast; book the visit in the same flow |
| 03:40 | `0d862a4` (Lucas) | Design-system specimen app | Reference for the components |
| 04:14 | `9f41ad6` | Photo AI: retries + per-type prompt (140 → 160.5/168) | Overnight measured cycles; reliability on free models |
| 05:28 | `a0c0ae7` | The Bruce simulator, the spoken-answer engine, prompt v3, live frames, Playwright | Test Bruce on 8 personas without voice credits; understand "nope"/"I rent"/postal codes in code; test the live screen with the real walkthrough as a camera |
| 06:15 | `9ac86f6` | Bruce prompt v5 (85.14/88 across 8 personas) | v4 was rejected after a new check caught it inventing an answer |
| 10:40 | `42234e5` | PR #1 merged | The overnight work went into main |
| 14:07 | `5a910fa` | **The Hub**: relationship engine, consent-safe outreach, flood check-ins | The user's ask: Rockefeller-style memory, flood outreach, SMS/email, one dashboard. Plan red-teamed by 4 subagents first (`plan/HUB_PLAN.md`) |
| 14:21 | `31d1592` | Hub P1: booking consent + profile link, day sheet, research, settings, privacy | The legal reviewer's blocking items (consent collection, recording disclosure); inspector and research needs |

## Notable moments worth telling
- **The idea that died:** "YOLO detects mold" lost to the owner, engineer and staff personas within the first debate round. We kept vision only as an evidence assistant.
- **The evaluation that caught us:** the first photo evaluation showed the AI stating mold as fact on 4 of 24 photos. The prompt and the scoring were fixed, and it has been 0/24 since.
- **The improvement we threw away:** Bruce v4 scored higher, but a new check showed it saving "symptoms: yes" before the customer answered. Rejected, then fixed in v5.
- **The day with no AI:** the free quota ran out before the hub build, so every AI feature got a reviewed rule-based fallback. That's why the whole demo now works offline.
- **The flood that wasn't:** Environment Canada had 0 water alerts on build day (26 snowfall, 23 special statements, 15 wind), so the demo simulates an alert over the real Gatineau forecast-zone outline.
- **The legal catch:** the privacy reviewer pointed out that a flood "check-in" with a booking link is a commercial message under CASL, so there are now two kinds of storm message.

## People
- **Shrey:** product direction, decisions, review.
- **Lucas Vu:** design system, live voice mode, accessible theme, booking.
- **Devin (AI agent):** planning, multi-agent reviews, backend, frontend, evaluations, tests and docs, under the team's direction.
