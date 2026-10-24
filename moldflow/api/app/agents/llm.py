"""Single entry point for every AI call: Pydantic-validated structured output with repair,
model fallback, two-tier cache (exact + fixture), concurrency limit, and usage/provenance logging.
Why free models + fallbacks + quota breaker: docs/04_decisions.md D17."""
import asyncio
import base64
import hashlib
import io
import json
import logging
import re
import time
from dataclasses import dataclass
from typing import TypeVar

from openai import APIStatusError, APITimeoutError, AsyncOpenAI
from PIL import Image, ImageOps
from pydantic import BaseModel, ValidationError

from app import config
from app.models.passport import AIUsage

log = logging.getLogger("moldflow.llm")
T = TypeVar("T", bound=BaseModel)

GUARDRAILS = """Rules you must always follow:
- You assist a professional mold inspection company. You NEVER diagnose or confirm mold. Visible discoloration is "possibly fungal; cannot be confirmed without physical sampling and laboratory analysis".
- A thermal anomaly is a clue that needs context, not proof of moisture or mold. Swab tests are non-speciating: never name a mold species.
- Never give medical advice. Never invent prices, discounts, offers, measurements or facts not given to you.
- Be concise, calm and plain-spoken."""

_client: AsyncOpenAI | None = None
_sem = asyncio.Semaphore(config.LLM_CONCURRENCY)
_rate_lock = asyncio.Lock()
_next_slot = 0.0


async def _throttle() -> None:
    """Space live requests evenly at LLM_RPM (process-wide), so bursts never trip the provider's per-minute limit."""
    global _next_slot
    async with _rate_lock:
        now_ = time.monotonic()
        wait = max(0.0, _next_slot - now_)
        _next_slot = max(now_, _next_slot) + 60.0 / config.LLM_RPM
    if wait:
        await asyncio.sleep(wait)


class AgentFailure(Exception):
    pass


_quota_until = 0.0  # epoch seconds; set when the provider says the daily free quota is used up


def quota_exhausted() -> bool:
    return time.time() < _quota_until


def _note_quota(err: Exception) -> None:
    """Daily free-tier quota hit: stop calling the provider until 00:00 UTC (fail fast to fixtures/rules)."""
    global _quota_until
    msg = str(err).lower()
    if "per-day" in msg or "free-models-per-day" in msg or "daily" in msg and "limit" in msg:
        import datetime as _dt
        tomorrow = (_dt.datetime.now(_dt.timezone.utc) + _dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        _quota_until = tomorrow.timestamp()
        log.warning("daily AI quota exhausted; using fixtures/rules until %s UTC", tomorrow.isoformat())


class TransientError(Exception):
    """Provider returned an empty/malformed response (seen on free tiers): retry like a 5xx."""


@dataclass
class Result:
    value: BaseModel
    usage: AIUsage


def client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(base_url=config.OPENROUTER_BASE_URL, api_key=config.OPENROUTER_API_KEY or "missing",
                              timeout=config.LLM_TIMEOUT_S, max_retries=0)
    return _client


def prepare_image(raw: bytes, max_side: int = 1280) -> bytes:
    """Normalize any uploaded image to an upright JPEG <= max_side (fixes EXIF rotation and size)."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    img.thumbnail((max_side, max_side))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return buf.getvalue()


def _extract_json(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S).strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        text = fence.group(1)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    return text[start:end + 1]


def _schema_prompt(model_cls: type[BaseModel]) -> str:
    return ("Return ONLY one JSON object (no prose, no markdown) that validates against this JSON Schema:\n"
            + json.dumps(model_cls.model_json_schema(), separators=(",", ":")))


def _exact_key(agent: str, model_cls: type, system: str, user_text: str, images: list[bytes]) -> str:
    h = hashlib.sha256()
    for part in (agent, model_cls.__name__, system, user_text, *[hashlib.sha256(i).hexdigest() for i in images]):
        h.update(part.encode() if isinstance(part, str) else part)
    return h.hexdigest()[:32]


def _fixture_path(key: str):
    return config.FIXTURE_DIR / (re.sub(r"[^a-zA-Z0-9_.-]", "_", key) + ".json")


def _read(path, model_cls: type[T]) -> T | None:
    try:
        return model_cls.model_validate_json(json.loads(path.read_text())["value"])
    except Exception:
        return None


def _write(path, value: BaseModel, model: str):
    path.write_text(json.dumps({"model": model, "value": value.model_dump_json()}, indent=1))


async def _call_model(model: str, model_cls: type[T], messages: list[dict], max_tokens: int, temperature: float = 0.2) -> tuple[T, dict]:
    """One model, with up to 2 repair turns on invalid JSON / schema errors."""
    msgs = list(messages)
    tokens_in = tokens_out = 0
    cost = 0.0
    last_err = ""
    for attempt in range(3):
        extra: dict = {"usage": {"include": True}}
        if model == config.PRIMARY_MODEL and config.DISABLE_REASONING:
            extra["reasoning"] = {"enabled": False}  # ~3x faster on Nemotron; some routers (openrouter/free) reject this
        await _throttle()
        async with _sem:
            resp = await client().chat.completions.create(model=model, messages=msgs, max_tokens=max_tokens,
                                                          temperature=temperature, extra_body=extra)
        u = resp.usage
        if u:
            tokens_in += u.prompt_tokens or 0
            tokens_out += u.completion_tokens or 0
            cost += float((u.model_extra or {}).get("cost") or 0)
        if not getattr(resp, "choices", None):
            raise TransientError(f"{model} returned no choices")
        raw = resp.choices[0].message.content or ""
        try:
            return model_cls.model_validate_json(_extract_json(raw)), {"tokens_in": tokens_in, "tokens_out": tokens_out, "cost_usd": cost}
        except (ValidationError, ValueError) as e:
            last_err = str(e)[:1500]
            log.warning("agent output invalid (attempt %s, %s): %s", attempt + 1, model, last_err[:200])
            msgs = msgs + [{"role": "assistant", "content": raw[:4000]},
                           {"role": "user", "content": f"That output was invalid: {last_err}\nReturn ONLY the corrected JSON object."}]
    raise AgentFailure(f"invalid output after repairs: {last_err[:300]}")


async def structured(model_cls: type[T], *, agent: str, system: str, user_text: str,
                     images: list[bytes] | None = None, fixture_key: str | None = None,
                     max_tokens: int = 1500, mode: str | None = None, temperature: float = 0.2) -> Result:
    images = images or []
    mode = mode or config.DEMO_MODE
    full_system = f"{system}\n\n{GUARDRAILS}\n\n{_schema_prompt(model_cls)}"
    exact = config.EXACT_CACHE_DIR / f"{_exact_key(agent, model_cls, full_system, user_text, images)}.json"
    fixture = _fixture_path(fixture_key) if fixture_key else None
    t0 = time.monotonic()

    def done(value, model, tier, meta=None) -> Result:
        return Result(value, AIUsage(agent=agent, model=model, latency_ms=int((time.monotonic() - t0) * 1000), tier=tier, **(meta or {})))

    if config.E2E_STUB:
        from app.agents.stubs import STUBS
        if model_cls.__name__ in STUBS:
            return done(model_cls.model_validate(STUBS[model_cls.__name__]), "e2e-stub", "fixture")
        raise AgentFailure(f"e2e: no stub for {model_cls.__name__} (rule-based fallback)")
    if mode == "fixture" and fixture and (v := _read(fixture, model_cls)):
        return done(v, "fixture", "fixture")
    if mode in ("fixture", "hybrid") and (v := _read(exact, model_cls)):
        return done(v, "cache", "exact_cache")

    content: list[dict] = [{"type": "text", "text": user_text}]
    for img in images:
        content.append({"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + base64.b64encode(img).decode()}})
    messages = [{"role": "system", "content": full_system}, {"role": "user", "content": content}]

    errors = []
    if quota_exhausted() and mode != "live":
        if fixture and (v := _read(fixture, model_cls)):
            return done(v, "fixture", "fixture")
        raise AgentFailure("daily AI quota exhausted (resets 00:00 UTC)")
    attempts = [("live", config.PRIMARY_MODEL)] * (1 + config.PRIMARY_RETRIES) + [("fallback", config.FALLBACK_MODEL)]
    for n, (tier, model) in enumerate(attempts):
        if n and tier == "live":
            await asyncio.sleep(1.5 * n)  # backoff before retrying a transient provider error
        try:
            budget = max_tokens * 4 if "reasoning" in model else max_tokens  # reasoning tokens count against max_tokens
            value, meta = await _call_model(model, model_cls, messages, budget, temperature)
            _write(exact, value, model)
            if fixture and not fixture.exists():
                _write(fixture, value, model)
            return done(value, model, tier, meta)
        except AgentFailure as e:  # invalid JSON after repairs: retrying the same model rarely helps, go to fallback
            errors.append(f"{model}: {type(e).__name__} {str(e)[:160]}")
            log.warning("agent %s failed on %s: %s", agent, model, errors[-1])
            if tier == "live":
                attempts[n + 1:] = [a for a in attempts[n + 1:] if a[0] != "live"]
        except (APIStatusError, APITimeoutError, asyncio.TimeoutError, TransientError) as e:
            errors.append(f"{model}: {type(e).__name__} {str(e)[:160]}")
            log.warning("agent %s failed on %s: %s", agent, model, errors[-1])
            status = getattr(e, "status_code", None)
            if status == 429:
                _note_quota(e)
                if quota_exhausted():
                    break
            if tier == "live" and status is not None and status not in (429, 500, 502, 503, 504):
                attempts[n + 1:] = [a for a in attempts[n + 1:] if a[0] != "live"]  # 4xx won't fix itself
    if fixture and (v := _read(fixture, model_cls)):
        return done(v, "fixture", "fixture")
    raise AgentFailure("; ".join(errors) or "no model available")
