"""On-site inspection booking: a technician visits the property Monday to Friday in fixed 75-minute slots (Eastern Time).

Online booking is for homeowners, landlords, businesses and property managers; tenants must phone. The calendar is
simulated: other customers' bookings are seeded deterministically, and real bookings made in MoldFlow are removed
from availability."""
from datetime import date, timedelta
from zlib import crc32

TIMEZONE = "America/Toronto"
TIMEZONE_LABEL = "Eastern Time - Toronto"
SLOT_TIMES = ["10:00 AM", "11:15 AM", "12:30 PM", "1:45 PM", "3:00 PM", "4:15 PM"]
LEAD_DAYS = 6          # first bookable day is at least this many days out
DAYS_SHOWN = 10        # weekdays offered
TENANT_PHONE = "1-877-566-6653"
POLICY = ("Online booking is available for home owners, landlords, businesses & property managers only. "
          f"Tenants must call us at {TENANT_PHONE} to schedule. Additional fees may apply.")
CUSTOMER_TYPES = {"homeowner": "Homeowner", "landlord": "Landlord", "business": "Business",
                  "property_manager": "Property manager", "tenant": "Tenant"}
BOOKABLE_TYPES = set(CUSTOMER_TYPES) - {"tenant"}
TIPS = {10: "Tip Jar - Support Us ($10)", 15: "Tip Jar - Support Us ($15)", 25: "Tip Jar - Support Us ($25)"}

# Slots already held by other customers in the simulated calendar. These dates reproduce the published schedule; any
# other weekday loses one slot chosen deterministically from the date, so availability looks realistic and stable.
SEEDED_TAKEN: dict[date, set[str]] = {
    date(2026, 10, 30): {"1:45 PM"},
    date(2026, 11, 2): {"1:45 PM"},
    date(2026, 11, 3): {"4:15 PM"},
    date(2026, 11, 4): {"11:15 AM"},
}


def _seeded(d: date) -> set[str]:
    return SEEDED_TAKEN.get(d, {SLOT_TIMES[crc32(d.isoformat().encode()) % len(SLOT_TIMES)]})


def relative_week(d: date, today: date) -> str:
    weeks = (d - (today - timedelta(days=today.weekday()))).days // 7
    return "this week" if weeks == 0 else "next week" if weeks == 1 else f"in {weeks} weeks"


def bookable_days(today: date) -> list[date]:
    days, d = [], today + timedelta(days=LEAD_DAYS)
    while len(days) < DAYS_SHOWN:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def availability(today: date, booked: set[tuple[date, str]]) -> list[dict]:
    out = []
    for d in bookable_days(today):
        free = [t for t in SLOT_TIMES if t not in _seeded(d) and (d, t) not in booked]
        if free:
            out.append({"date": d.isoformat(), "weekday": f"{d:%A}", "label": f"{d:%b} {d.day}",
                        "relative": relative_week(d, today), "slots": free})
    return out


def is_available(d: date, t: str, today: date, booked: set[tuple[date, str]]) -> bool:
    return d in bookable_days(today) and t in SLOT_TIMES and t not in _seeded(d) and (d, t) not in booked


def slot_text(d: date, t: str) -> str:
    return f"{d:%A}, {d:%b} {d.day} · {t} ET"
