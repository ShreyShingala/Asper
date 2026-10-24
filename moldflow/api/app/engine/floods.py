"""Environment Canada weather alerts -> past customers in the area.

Live source: https://api.weather.gc.ca/collections/weather-alerts/items (GeoJSON, no key; Polygon/MultiPolygon in lon/lat).
Only water-related alerts matter (rainfall, flood, storm surge, freezing rain, special statements that mention heavy
rain/flooding). Matching is by postal-area centroid (FSA precision). Fixture/e2e modes never hit the network; the demo
can simulate an alert over a real forecast-zone outline from app/data/forecast_zones.json."""
import re
from datetime import datetime, timedelta

import httpx

from app import clock, config
from app.engine import geo
from app.models.crm import AlertEvent, AlertMatch, Contact, Interaction, ProfileFact

URL = "https://api.weather.gc.ca/collections/weather-alerts/items"
WATER_TYPES = re.compile(r"rainfall|flood|storm surge|freezing rain|heavy rain|pluie|inondation|crue", re.I)
WATER_TEXT = re.compile(r"heavy rain|flood|runoff|rainfall amounts|ponding|inondation|fortes pluies", re.I)


def is_water(props: dict) -> bool:
    name = f"{props.get('alert_name_en', '')} {props.get('alert_short_name_en', '')}"
    return bool(WATER_TYPES.search(name)) or ("statement" in name.lower() and bool(WATER_TEXT.search(props.get("alert_text_en", ""))))


def _dt(v: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None) if v else None
    except ValueError:
        return None


async def fetch_live(limit: int = 500) -> list[AlertEvent]:
    """Water-related, non-ended alerts touching ON/QC. Raises on network errors (caller decides)."""
    async with httpx.AsyncClient(timeout=20) as h:
        r = await h.get(URL, params={"f": "json", "limit": limit})
        r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        p = f.get("properties", {})
        if p.get("province") not in ("ON", "QC") or p.get("status_en") == "ended" or not is_water(p):
            continue
        out.append(AlertEvent(id=f"ec-{p.get('feature_id', '')}-{(p.get('publication_datetime') or '')[:16]}", source="env_canada",
                              type=p.get("alert_name_en", "alert"), area=p.get("feature_name_en", ""), geometry=f.get("geometry") or {},
                              starts=_dt(p.get("validity_datetime")), ends=_dt(p.get("expiration_datetime")),
                              text_en=(p.get("alert_text_en") or "")[:1500], text_fr=(p.get("alert_text_fr") or "")[:1500]))
    return out


def simulated(zone: str, kind: str = "rainfall warning") -> AlertEvent:
    z = geo.zones()[zone]
    now = clock.now()
    return AlertEvent(id=f"sim-{zone.lower().replace(' ', '-')}-{now:%Y%m%d%H%M}", source="simulated", type=kind, area=zone,
                      geometry={"type": z["type"], "coordinates": z["coordinates"]}, starts=now, ends=now + timedelta(hours=24),
                      text_en=f"(SIMULATED for the demo) Rainfall warning for {zone}: 50 to 70 mm of rain expected over 24 hours. "
                              "Localized flooding in low-lying areas is possible.",
                      text_fr=f"(SIMULÉ pour la démo) Avertissement de pluie pour {z['props'].get('NOM', zone)} : de 50 à 70 mm de pluie en 24 heures. "
                              "Des inondations locales sont possibles.")


def match(alert: AlertEvent, contacts: list[Contact], facts: dict[str, list[ProfileFact]], interactions: dict[str, list[Interaction]]) -> list[AlertMatch]:
    out = []
    for c in contacts:
        if c.do_not_contact or c.merged_into:
            continue
        hit = next((p for p in c.properties if p.lat is not None and geo.point_in_geometry(p.lat, p.lon, alert.geometry)), None)
        if not hit:
            continue
        water = any(re.search(r"flood|water|basement|sump|inond", f.text, re.I) for f in facts.get(c.id, [])) or \
            any(re.search(r"basement|water|leak|flood", i.summary, re.I) for i in interactions.get(c.id, []))
        if c.prefs.storm_checkin_opt_in:
            out.append(AlertMatch(contact_id=c.id, priority=1, reason=f"asked for storm check-ins · {hit.city} ({hit.fsa})"))
        elif water:
            out.append(AlertMatch(contact_id=c.id, priority=2, reason=f"past water/basement issue · {hit.city} ({hit.fsa})"))
        else:
            out.append(AlertMatch(contact_id=c.id, priority=3, reason=f"in the area · {hit.city} ({hit.fsa})"))
    return sorted(out, key=lambda m: m.priority)


def live_allowed() -> bool:
    return not config.E2E_STUB and config.DEMO_MODE != "fixture"
