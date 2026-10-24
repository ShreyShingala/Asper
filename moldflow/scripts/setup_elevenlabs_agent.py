"""Create or update the ElevenLabs agent that runs the live camera + voice pre-assessment ("Bruce").

Idempotent: tools are matched by name and the agent by ELEVENLABS_AGENT_ID (or by name), then patched in place.
The agent id is written back to api/.env.local. Re-run after editing the prompt or tools below.
Needs ELEVENLABS_API_KEY with ElevenAgents write + Voices read permissions.
Usage (from moldflow/api): uv run python ../scripts/setup_elevenlabs_agent.py"""
import re
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
from app import config  # noqa: E402
from app.agents.bruce import ASR_KEYWORDS, FIRST_MESSAGE, PROMPT, QUESTION_KEYS, TOOLS  # noqa: E402,F401  (re-exported for simulate_call)

AGENT_NAME = "MoldFlow Live Pre-Assessment (Bruce)"
VOICE_ID = "SAz9YHcvj6GT2YYXdXww"  # "River - Relaxed, Neutral, Informative" (calm stock voice); swap here
LLM = "gemini-2.5-flash"
ENV_FILE = config.API_DIR / ".env.local"


def upsert_tools(http: httpx.Client) -> list[str]:
    r = http.get("/v1/convai/tools")
    r.raise_for_status()
    existing = {t["tool_config"]["name"]: t["id"] for t in r.json().get("tools", []) if t.get("tool_config", {}).get("name")}
    ids = []
    for cfg in TOOLS:
        if tid := existing.get(cfg["name"]):
            http.patch(f"/v1/convai/tools/{tid}", json={"tool_config": cfg}).raise_for_status()
            print(f"  updated tool {cfg['name']} ({tid})")
        else:
            tid = http.post("/v1/convai/tools", json={"tool_config": cfg}).raise_for_status().json()["id"]
            print(f"  created tool {cfg['name']} ({tid})")
        ids.append(tid)
    return ids


def find_agent(http: httpx.Client) -> str | None:
    if config.ELEVENLABS_AGENT_ID:
        return config.ELEVENLABS_AGENT_ID
    r = http.get("/v1/convai/agents", params={"search": AGENT_NAME, "page_size": 30})
    r.raise_for_status()
    return next((a["agent_id"] for a in r.json().get("agents", []) if a.get("name") == AGENT_NAME), None)


def save_agent_id(agent_id: str) -> None:
    text = ENV_FILE.read_text() if ENV_FILE.exists() else ""
    line = f"ELEVENLABS_AGENT_ID={agent_id}"
    text = re.sub(r"(?m)^ELEVENLABS_AGENT_ID=.*$", line, text) if "ELEVENLABS_AGENT_ID=" in text else text.rstrip("\n") + f"\n{line}\n"
    ENV_FILE.write_text(text)


def main() -> None:
    if not config.ELEVENLABS_API_KEY:
        sys.exit(f"ELEVENLABS_API_KEY is not set in {ENV_FILE}")
    with httpx.Client(base_url=config.ELEVENLABS_BASE_URL, headers={"xi-api-key": config.ELEVENLABS_API_KEY}, timeout=30) as http:
        print("Tools:")
        tool_ids = upsert_tools(http)
        body = {
            "name": AGENT_NAME,
            "tags": ["moldflow"],
            "conversation_config": {
                "agent": {
                    "first_message": FIRST_MESSAGE,
                    "language": "en",
                    "max_conversation_duration_message": "We're at the time limit, so I'll put your pre-assessment together now.",
                    "prompt": {"prompt": PROMPT, "llm": LLM, "temperature": 0.3, "tool_ids": tool_ids, "timezone": "America/Toronto"},
                },
                "tts": {"voice_id": VOICE_ID, "expressive_mode": False},
                "asr": {"keywords": ASR_KEYWORDS},
                "conversation": {"max_duration_seconds": config.LIVE_MAX_SECONDS},
            },
            "platform_settings": {"auth": {"enable_auth": True}},
        }
        agent_id = find_agent(http)
        if agent_id:
            r = http.patch(f"/v1/convai/agents/{agent_id}", json=body)
            if r.status_code == 404:
                agent_id = None
            else:
                r.raise_for_status()
                print(f"Updated agent {agent_id}")
        if not agent_id:
            agent_id = http.post("/v1/convai/agents/create", json=body).raise_for_status().json()["agent_id"]
            print(f"Created agent {agent_id}")
    save_agent_id(agent_id)
    print(f"Saved ELEVENLABS_AGENT_ID to {ENV_FILE}. Restart the API to pick it up.")


if __name__ == "__main__":
    try:
        main()
    except httpx.HTTPStatusError as e:
        sys.exit(f"ElevenLabs API error {e.response.status_code} on {e.request.method} {e.request.url.path}: {e.response.text[:600]}")
