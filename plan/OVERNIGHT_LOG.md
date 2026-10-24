# Overnight log: Bruce (live voice) + photo AI on the sample pack

Branch `overnight/ai-20261024`, started 2026-10-24 03:57 EDT. Scores are **agreement with the organizer captions on the
sample pack (n=24, illustrative)**, never "accuracy". Reference reports were never used as model input.

## Blockers found at start
- **No ElevenLabs key on this machine.** `moldflow/api/.env.local` holds only `OPENROUTER_API_KEY`; neither
  `ELEVENLABS_API_KEY` nor `ELEVENLABS_AGENT_ID` is set in the file or the shell. So: **0 real ElevenLabs calls tonight,
  0 minutes, $0 spent.** The setup script was not re-run (it would exit without a key).
- Mitigation (mission step 5): `simulate_call.py` speaks the real ElevenLabs Agents WebSocket protocol (ready for when a key
  exists) **and** has a `--backend local` stand-in that runs the exact same Bruce prompt, first message and the four tool
  contracts on the OpenRouter free model, against the real MoldFlow API. Everything measured that way is labelled
  **"not verified with a live call"** (different LLM: free Nemotron vs the agent's gemini-2.5-flash; text, not audio).
- OpenRouter free tier: 907 of 1,000 requests left for the UTC day at start (93 used earlier). Throttled to 15/min.

## Spend
| When (EDT) | What | OpenRouter req | ElevenLabs calls / min |
|---|---|---|---|
| 04:00-04:35 | baseline + c1 + c2 photo runs (3x24), model probes (5), demo_api_run, FR fixtures | ~95 | 0 / 0 |
| 04:35-05:35 | frames x2 (59 each + retries), Bruce sim: 1 probe + baseline 4 + c1 4 + c2 3 calls, photo c3 (24), demo_api_run + fixtures | ~470 | 0 / 0 |

## Photo analysis cycles (total = 7 metrics x 24 photos = 168)
| Cycle | Change | Total | Overclaims | Type | Speakable | Median s | Decision |
|---|---|---|---|---|---|---|---|
| baseline | as found (prompt from build day) | 140.0 | 0 | 20/24 | 5/24 | 11.8 | 2 rows were silently served from old fixtures and several by the fallback |
| c1 | reliability: retry primary on 5xx/429 with backoff; fallback openrouter/free -> nemotron nano-omni (openrouter/free routes to Nemotron with reasoning forced on, burns tokens, returns empty content); eval no longer falls back to fixtures | 136.5 | 0 | 20/24 | 2/24 | **2.9** | keep: latency 11.8 -> 2.9 s, 0 fixture contamination. Score delta is sampling noise at T=0.2 (same prompt) |
| c2 | photo prompt v2 (per image type rules, <=12-word spoken observations, region rules, flashlight != dark) + temperature 0 for photos | **160.5** | 0 | **23/24** | **23/24** | 2.3 | **keep**: every group up (test_kit 4.6 -> 6.6, instrument 5.5 -> 6.75). 2 photos -1/-1.5 (15 no region; 17 called the attic a crawlspace), no overclaim regressions |
| c3 | prompt v3 (quality rules for live frames) | **162.0** | 0 | 23/24 | **24/24** | 2.3 | keep: total up, 0 overclaims. 2 photos -0.5/-1 (vent grille now "blurry" so no box; ceiling vent got a whole-image box -> such boxes are now dropped in the PhotoAnalysis validator) |

## Walkthrough video frames (59 frames, 1 per 3 s, human labels: 8 unusable, 14 vent/hose close-ups)
| Run | Unusable flagged | Vent/hose consistent with stills | Overclaims | Notes |
|---|---|---|---|---|
| prompt v2 | 3/7 | 11/14 | 0 | boxes / blank wall called "ok". 32/59 frames "blurry" (low-res video). (1 frame errored on a provider 502) |
| c3: prompt v3 quality rules for live frames (people, boxes, furniture = not_relevant; judge soft frames by visible surface) + server brightness rule (mean luma < 28 -> too_dark, no model call) | **5/7** | **12/15** | 0 | keep. Correction: frame 59 was first labelled "black" from a contact sheet whose last tile was padding; it is a baseboard. Both runs re-scored with the fixed labels, no new calls |

## Camera thresholds (web/src/lib/camera.ts), tuned on the walkthrough by emulating the 64x48 probe (scripts/camera_thresholds.py)
- DARK_LUMA 42 kept: vent/hose close-ups never go below luma 96 -> 0 false "too dark"; only the 4 black transitions trip it.
- MOVING_DIFF 22 -> 30: false "hold still" episodes on steady close-ups 5 -> 3 (overall 20 -> 19; real pans still caught).
- Capture margin 6 -> 4 (rejects when steadiest frame diff > MOVING_DIFF + margin): close-up seconds rejected 11% -> 7%.

## Bruce, simulated calls (local stand-in = NOT verified with a live call). Score /11 per call
Parts: answers, concern, shots, finished, service, rules, short turns, no repeats, summary grounded, persona checks, in time.
| Run | job2-virtual | job1-washroom | messy | quitter | Total /44 | Violations | Finished |
|---|---|---|---|---|---|---|---|
| baseline (original prompt + engine) | 6.87 | 10.45 | 5.80 | 9.86 | **32.98** | 0* | 2/4 |
| c1: prompt v2 (save every fact immediately, never "noted" without saving, follow next_step, finish rule, price/health deflections, read back postal code) + engine: spoken-answer understanding + next_step | 8.92 | 9.67 | 7.52 | 10.00 | **36.11** | 0 | 3/4 |
| c2: prompt v3 (vague answer -> save Not sure, save postal first then read back once, no repeating after a tool result) + simulator fidelity (customer confirms read-backs; several tool calls per step like the real agent) | **9.00** | **10.00** | **8.89** | (not re-run) | 27.89/33 on the 3 | 0 | 3/3 |

\* The first scoring flagged "I can't give you a price right now" as a price violation; the check was corrected to only flag
quoted amounts (the refusal is the required behaviour) and re-applied to the saved transcripts (no new calls).
Notes: the baseline job2 score is depressed by a simulator bug fixed later (the rule-based customer didn't recognise
"Where is this area?" as the room question). c1 job1 (-0.78 vs baseline) came from the new postal read-back that the
rule-based customer could not answer (simulator gap, fixed in c2) and the one-tool-per-step stand-in. Kept c2 because every
re-run persona improved over c1; job1 remains 0.45 under the (differently simulated) baseline, losing only "no repeats".
Baseline failure modes seen in transcripts: says "I've noted..." without calling save_answer (job2: 0 of 6 answers saved);
asks questions that were already answered; never calls finish_assessment when the customer goes quiet; 3-sentence turns.

### Full batch, all 8 personas, prompt v3 (05:28-05:50)
| Persona | Score /11 | Finished | Service (expected) | Notes |
|---|---|---|---|---|
| job2-virtual | **11.00** | yes | onsite (virtual/onsite/iaq) | all answers, concern, 4 shots |
| job1-washroom | 10.00 | yes | onsite (onsite) | never linked the photos to moisture/the faucet in its own words |
| tenant | 10.71 | yes | onsite; landlord letter offered; booking page shows tenant phone | 3 long turns |
| outside-canada | 10.81 | yes | remote_report (remote_report) | location saved "Australia, Sydney" (scorer now accepts country + city) |
| health | 9.80 | yes | iaq (iaq) | "I can't give medical advice, so please check with a doctor" said; 3-sentence turns; odour asked 3x |
| messy | 9.95 | yes | onsite (onsite) | vague answers saved as Not sure; symptoms/location asked 3x |
| dark-room | 9.83 | yes | iaq (any paid) | coached light after the too_dark capture; odour asked 3x |
| quitter | **11.00** | yes (customer_requested, after 1 photo) | onsite | pre-assessment still built |
| **Total** | **83.10 / 88** | **8/8** | 8/8 match | **0 rule violations**, all inside 5 min (simulated 115-203 s) |

### Cycle 3 (prompt v4: sentence budget incl. deflections; link photo comments to the customer's words), 3 personas
health 9.80 -> 10.80, dark-room 9.83 -> 9.92, job1 10.00 -> 10.75 on the original scorer. **But** job1's transcript shows the
stand-in saving symptoms = "Yes" before the customer answered (customer then said "No, we're all fine"). Added a scorer check
`contradicts_customer` (saved answer differs from what the customer said) and re-applied it to the saved batches (no calls):
final v3 batch unchanged (83.10, 0 violations); c3 job1 -> 9.75 with 1 violation -> **v4 rejected** (a persona got worse).

### Cycle 4 (prompt v5 = v4 + "only save what the customer said; ask one question, then wait"), same 3 personas
job1-washroom 10.00 -> **10.00** (no invented answer), health 9.80 -> **10.73**, dark-room 9.83 -> **10.94**; 0 violations
(contradiction check on). **Kept** -> committed prompt is v5. Previous prompts saved during the night: /tmp/setup_agent_v1..v4.py
(v1 = original, also recoverable from git history).

### Latest per persona (shown on /proof): 85.14 / 88, 8/8 finished, 0 violations
job2-virtual 11.00, tenant 10.71, outside-canada 10.81, messy 9.95, quitter 11.00 (last run on v3); job1-washroom 10.00,
health 10.73, dark-room 10.94 (v5). The five v3 personas were NOT re-run on v5 (free-tier request cap reached).

| When (EDT) | What | OpenRouter req | ElevenLabs calls / min |
|---|---|---|---|
| 05:35-06:15 | final 8-persona batch, Bruce c3 + c4 (3 personas each) | ~270 | 0 / 0 |
| **Night total** | | **959 of 1,000 free/day** (93 were used before the night) | **0 / 0 min, $0** |

## Final state (06:20)
- Photo: 140.0 -> **162.0 / 168**, 0 overclaims, image type 20 -> 23/24 (thermal 6/6, swab 3/4, meters 2/2), spoken-length
  observations 5 -> 24/24, median latency 11.8 -> 2.3 s.
- Frames: unusable flagged 3/7 -> 5/7; vent/hose frames consistent with stills 11/14 -> 12/15; 0 overclaims.
- Bruce (stand-in): 4-persona baseline 32.98/44 (2/4 finished) -> latest 85.14/88 on 8 personas, 8/8 finished, 0 violations.
- Checks: pytest 59 passed; demo_api_run passes live and offline (fixture mode, no key, empty cache); tsc, eslint, next build
  clean; Playwright 18/18 (desktop Chrome, iPhone 13, Pixel 7 viewports in Chromium) with the walkthrough as the camera.
- setup_elevenlabs_agent.py NOT re-run: it exits with "ELEVENLABS_API_KEY is not set". The live agent still runs the old
  prompt until someone with the key runs it.
