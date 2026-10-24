"""Server-side ElevenLabs calls. The API key never reaches the browser: we mint a short-lived signed URL per call."""
import httpx

from app import config


class VoiceUnavailable(Exception):
    pass


def enabled() -> bool:
    return bool(config.ELEVENLABS_API_KEY and config.ELEVENLABS_AGENT_ID)


async def signed_url() -> str:
    if not enabled():
        raise VoiceUnavailable("Live mode is not configured (ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID).")
    async with httpx.AsyncClient(base_url=config.ELEVENLABS_BASE_URL, timeout=15) as http:
        r = await http.get("/v1/convai/conversation/get-signed-url", params={"agent_id": config.ELEVENLABS_AGENT_ID},
                           headers={"xi-api-key": config.ELEVENLABS_API_KEY})
    if r.status_code != 200:
        raise VoiceUnavailable(f"ElevenLabs refused to start a call ({r.status_code}): {r.text[:200]}")
    return r.json()["signed_url"]
