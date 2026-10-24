"""Postal-area geography for alert matching. Precision is the forward sortation area (first 3 postal characters), about
5-15 km: good enough to match an Environment Canada forecast zone, and we never guess for unknown FSAs.
Zone outlines in app/data/forecast_zones.json are real Environment Canada public forecast zones
(api.weather.gc.ca collection public-standard-forecast-zones), saved so alerts can be simulated offline.
Verified: every service-area FSA lands in its real forecast zone (tests/test_hub.py); docs/04_decisions.md D11."""
import json
from functools import cache
from pathlib import Path

# FSA -> (lat, lon, zone). Approximate area centroids for the Mold Busters service area only.
FSA: dict[str, tuple[float, float, str]] = {
    # Ottawa
    "K1A": (45.423, -75.700, "City of Ottawa"), "K1N": (45.430, -75.690, "City of Ottawa"), "K1P": (45.420, -75.700, "City of Ottawa"),
    "K1S": (45.400, -75.690, "City of Ottawa"), "K1Y": (45.400, -75.730, "City of Ottawa"), "K1Z": (45.390, -75.750, "City of Ottawa"),
    "K1G": (45.390, -75.640, "City of Ottawa"), "K1J": (45.440, -75.600, "City of Ottawa"), "K1V": (45.350, -75.660, "City of Ottawa"),
    "K2B": (45.360, -75.800, "City of Ottawa"), "K2G": (45.330, -75.730, "City of Ottawa"), "K2J": (45.270, -75.740, "City of Ottawa"),
    "K2K": (45.340, -75.920, "City of Ottawa"), "K2M": (45.290, -75.880, "City of Ottawa"), "K4A": (45.470, -75.480, "City of Ottawa"),
    # Gatineau
    "J8X": (45.432, -75.725, "Gatineau"), "J8Y": (45.443, -75.752, "Gatineau"), "J8Z": (45.455, -75.790, "Gatineau"),
    "J8T": (45.475, -75.700, "Gatineau"), "J8P": (45.490, -75.640, "Gatineau"), "J9A": (45.405, -75.840, "Gatineau"),
    "J9H": (45.395, -75.870, "Gatineau"),
    # Montreal / Laval
    "H2X": (45.510, -73.570, "Metro Montréal - Laval"), "H2T": (45.522, -73.592, "Metro Montréal - Laval"),
    "H2J": (45.530, -73.580, "Metro Montréal - Laval"), "H3A": (45.503, -73.577, "Metro Montréal - Laval"),
    "H3H": (45.492, -73.580, "Metro Montréal - Laval"), "H4A": (45.470, -73.620, "Metro Montréal - Laval"),
    "H1A": (45.660, -73.500, "Metro Montréal - Laval"), "H7N": (45.560, -73.720, "Metro Montréal - Laval"),
    "H7T": (45.570, -73.750, "Metro Montréal - Laval"), "H7A": (45.620, -73.610, "Metro Montréal - Laval"),
    # Toronto
    "M5V": (43.642, -79.398, "City of Toronto"), "M4C": (43.690, -79.310, "City of Toronto"), "M6P": (43.660, -79.465, "City of Toronto"),
    "M5R": (43.672, -79.405, "City of Toronto"), "M1B": (43.806, -79.194, "City of Toronto"), "M9W": (43.715, -79.585, "City of Toronto"),
}


def fsa_of(postal: str | None) -> str | None:
    p = (postal or "").upper().replace(" ", "")
    return p[:3] if len(p) >= 3 and p[0].isalpha() and p[1].isdigit() and p[2].isalpha() else None


def locate(postal: str | None) -> tuple[float, float] | None:
    f = fsa_of(postal)
    return (FSA[f][0], FSA[f][1]) if f in FSA else None


def _in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
            inside = not inside
        j = i
    return inside


def _in_polygon(lon: float, lat: float, rings: list) -> bool:
    """GeoJSON polygon: first ring = outline, the rest = holes. Coordinates are [lon, lat]."""
    return bool(rings) and _in_ring(lon, lat, rings[0]) and not any(_in_ring(lon, lat, h) for h in rings[1:])


def point_in_geometry(lat: float, lon: float, geometry: dict) -> bool:
    t, coords = geometry.get("type"), geometry.get("coordinates") or []
    if t == "Polygon":
        return _in_polygon(lon, lat, coords)
    if t == "MultiPolygon":
        return any(_in_polygon(lon, lat, poly) for poly in coords)
    return False


@cache
def zones() -> dict[str, dict]:
    return json.loads((Path(__file__).resolve().parents[1] / "data" / "forecast_zones.json").read_text())
