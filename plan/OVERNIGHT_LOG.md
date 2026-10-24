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

## Photo analysis cycles (total = 7 metrics x 24 photos = 168)
| Cycle | Change | Total | Overclaims | Type | Speakable | Median s | Decision |
|---|---|---|---|---|---|---|---|
| baseline | as found (prompt from build day) | 140.0 | 0 | 20/24 | 5/24 | 11.8 | 2 rows were silently served from old fixtures and several by the fallback |
| c1 | reliability: retry primary on 5xx/429 with backoff; fallback openrouter/free -> nemotron nano-omni (openrouter/free routes to Nemotron with reasoning forced on, burns tokens, returns empty content); eval no longer falls back to fixtures | 136.5 | 0 | 20/24 | 2/24 | **2.9** | keep: latency 11.8 -> 2.9 s, 0 fixture contamination. Score delta is sampling noise at T=0.2 (same prompt) |
| c2 | photo prompt v2 (per image type rules, <=12-word spoken observations, region rules, flashlight != dark) + temperature 0 for photos | **160.5** | 0 | **23/24** | **23/24** | 2.3 | **keep**: every group up (test_kit 4.6 -> 6.6, instrument 5.5 -> 6.75). 2 photos -1/-1.5 (15 no region; 17 called the attic a crawlspace), no overclaim regressions |
