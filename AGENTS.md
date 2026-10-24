# AGENTS.md: soonHacks / MoldFlow

- App lives in `moldflow/` (FastAPI + Pydantic v2 in `api/`, Next.js 16 in `web/`). Plan: `plan/PLAN.md`. Run/verify/runbook: `moldflow/README.md`.
- Package managers: **uv** for Python (`moldflow/api`), **npm** for web (not bun). Add deps with a 7-day age guard: `uv` uses `exclude-newer` in pyproject; npm: `npm install --before=<date>`.
- Verify: `cd moldflow/api && uv run pytest -q && uv run python ../scripts/demo_api_run.py`; `cd moldflow/web && npx tsc --noEmit && npx eslint src && npx next build`.
- Regenerate TS types after Pydantic changes (API running): `cd moldflow/web && npm run gen:types`.
- Next.js 16 rules: read `web/node_modules/next/dist/docs/` before using unfamiliar APIs; client pages using `useParams` must sit under `<Suspense>` (see `page.tsx` + `client.tsx` pattern).
- Env vars are namespaced `MOLDFLOW_*` on purpose: this machine already has a global `DATA_DIR` (Open WebUI). Never use generic names.
- All AI calls go through `api/app/agents/llm.py::structured` with a Pydantic output model. Prices never come from the LLM.
- OpenRouter key has a $0 credit limit, so only `:free` models work (1,000 req/day, 20/min). `openrouter/free` rejects `reasoning.enabled=false`.
- Sample data: `Mold-Busters-Hackathon-Sample-Pack-v2/`. Never feed the reference report PDFs to a model.
- Live mode (ElevenLabs agent "Bruce"): prompt, voice, tools and limits live in `moldflow/scripts/setup_elevenlabs_agent.py`; edit there and re-run it (idempotent, from `moldflow/api`: `uv run python ../scripts/setup_elevenlabs_agent.py`). Never edit the agent in the dashboard. Collection rules are in `api/app/engine/live.py`. The ElevenLabs key must stay server-side (signed URLs only).
- The agent can be tested without a mic by connecting to the signed URL over WebSocket and sending `{"type":"user_message","text":...}`; answer `client_tool_call` with `client_tool_result` and `ping` with `pong`. Each test call uses ElevenLabs agent credits.
- On this Windows machine `uv` is installed as a pip user package: run it as `python -m uv ...`.
