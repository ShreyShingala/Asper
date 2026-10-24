"""One clock for the whole app so the demo can time-travel (moments, consent windows, quiet hours, estimate expiry).
MOLDFLOW_TODAY=YYYY-MM-DD (env) or POST /admin/clock sets an offset; everything calls today()/now() from here."""
import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Toronto")  # Ottawa, Gatineau, Montreal and Toronto share Eastern time
_offset = timedelta(0)


def _init() -> None:
    global _offset
    if v := os.getenv("MOLDFLOW_TODAY"):
        _offset = datetime.combine(date.fromisoformat(v), datetime.now().time()) - datetime.now()


def set_today(d: date | None) -> None:
    """None resets to the real clock."""
    global _offset
    _offset = timedelta(0) if d is None else datetime.combine(d, datetime.now().time()) - datetime.now()


def now() -> datetime:
    return (datetime.now() + _offset).replace(microsecond=0)


def today() -> date:
    return now().date()


def local_now() -> datetime:
    return datetime.now(TZ) + _offset


def is_travelling() -> bool:
    return abs(_offset) > timedelta(minutes=1)


_init()
