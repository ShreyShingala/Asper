import os
from pathlib import Path

from dotenv import load_dotenv

API_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = API_DIR.parents[1]
load_dotenv(API_DIR / ".env.local")

PACK_DIR = Path(os.getenv("MOLDFLOW_PACK_DIR", REPO_DIR / "Mold-Busters-Hackathon-Sample-Pack-v2"))
DATA_DIR = Path(os.getenv("MOLDFLOW_DATA_DIR", API_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "moldflow.db"
CACHE_DIR = API_DIR / "cache"
FIXTURE_DIR = CACHE_DIR / "fixtures"
EXACT_CACHE_DIR = CACHE_DIR / "exact"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "nvidia/nemotron-3.5-super-vl:free")
# openrouter/free is NOT a usable fallback: it routes to the same Nemotron with reasoning forced on, which burns the token
# budget and returns empty content. nano-omni is slow (~40 s, reasoning) but reliably returns valid JSON.
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")
PRIMARY_RETRIES = int(os.getenv("PRIMARY_RETRIES", "2"))  # transient 5xx/429 from free providers are common
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "25"))
DISABLE_REASONING = os.getenv("DISABLE_REASONING", "1") == "1"
LLM_RPM = float(os.getenv("LLM_RPM", "15"))  # OpenRouter free tier allows 20/min; stay under it
LLM_CONCURRENCY = int(os.getenv("LLM_CONCURRENCY", "3"))
# fixture: fixture -> exact cache -> live | hybrid: exact cache -> live -> fallback -> fixture | live: always live
DEMO_MODE = os.getenv("MOLDFLOW_DEMO_MODE", "hybrid")
E2E_STUB = os.getenv("MOLDFLOW_E2E_STUB") == "1"  # browser tests only: canned AI outputs, zero model calls
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Live camera + voice pre-assessment (ElevenLabs Agents). The agent is created by scripts/setup_elevenlabs_agent.py.
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_AGENT_ID = os.getenv("ELEVENLABS_AGENT_ID", "")
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io"
LIVE_MAX_PHOTOS = int(os.getenv("LIVE_MAX_PHOTOS", "6"))
LIVE_MAX_SECONDS = int(os.getenv("LIVE_MAX_SECONDS", "300"))

for d in (UPLOAD_DIR, FIXTURE_DIR, EXACT_CACHE_DIR):
    d.mkdir(parents=True, exist_ok=True)
