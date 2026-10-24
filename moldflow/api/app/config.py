import os
from pathlib import Path

from dotenv import load_dotenv

API_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = API_DIR.parents[1]
load_dotenv(API_DIR / ".env.local")

PACK_DIR = Path(os.getenv("PACK_DIR", REPO_DIR / "Mold-Busters-Hackathon-Sample-Pack-v2"))
DATA_DIR = Path(os.getenv("DATA_DIR", API_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "moldflow.db"
CACHE_DIR = API_DIR / "cache"
FIXTURE_DIR = CACHE_DIR / "fixtures"
EXACT_CACHE_DIR = CACHE_DIR / "exact"

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PRIMARY_MODEL = os.getenv("PRIMARY_MODEL", "nvidia/nemotron-3.5-super-vl:free")
FALLBACK_MODEL = os.getenv("FALLBACK_MODEL", "openrouter/free")
LLM_TIMEOUT_S = float(os.getenv("LLM_TIMEOUT_S", "25"))
LLM_CONCURRENCY = int(os.getenv("LLM_CONCURRENCY", "3"))
# fixture: fixture -> exact cache -> live | hybrid: exact cache -> live -> fallback -> fixture | live: always live
DEMO_MODE = os.getenv("DEMO_MODE", "hybrid")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

for d in (UPLOAD_DIR, FIXTURE_DIR, EXACT_CACHE_DIR):
    d.mkdir(parents=True, exist_ok=True)
