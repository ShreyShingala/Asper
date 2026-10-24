"""Deterministic pricing. The AI never produces a number; it only explains what this module computes."""
from datetime import date, timedelta
from decimal import Decimal
from functools import cache
from pathlib import Path

import yaml

from app.models.passport import CENT, Estimate, LineItem


@cache
def table() -> dict:
    return yaml.safe_load((Path(__file__).parent / "pricing.yaml").read_text())


def service_price_text(service: str, province: str, lang: str = "en") -> str:
    s = table()["services"].get(service)
    if not s:
        return ""
    label = s[f"label_{lang}"]
    if s["tax_included"]:
        return f"{label}: ${s['price']} " + ("taxes incluses" if lang == "fr" else "incl. tax")
    tax = table()["taxes"].get(province)
    suffix = (f" + {tax['label']}" if tax else (" + taxes" if lang == "fr" else " + applicable tax"))
    return f"{label}: ${s['price']}{suffix}"


def tax_for(province: str) -> tuple[Decimal, str]:
    t = table()["taxes"].get(province)
    if not t:
        raise ValueError(f"no tax rule for province '{province}'")
    return Decimal(t["rate"]), t["label"]


def build_estimate(*, est_id: str, service: str, areas: list[str], subtotal: Decimal, province: str,
                   issued_on: date, source: str, scope_text: list[str] | None = None,
                   duration_text: str | None = None, status: str = "draft", split: bool = False,
                   standard_terms: bool = True, extra_terms: list[str] | None = None) -> Estimate:
    rate, label = tax_for(province)
    terms = table()["estimate_terms"]
    subtotal = subtotal.quantize(CENT)
    tax = (subtotal * rate).quantize(CENT)
    items: list[LineItem] = []
    if split:
        running = Decimal("0")
        parts = table()["illustrative_remediation_split"]
        for i, p in enumerate(parts):
            amt = (subtotal - running) if i == len(parts) - 1 else (subtotal * Decimal(p["share"])).quantize(CENT)
            running += amt
            items.append(LineItem(code=p["code"], description=p["description"], unit_price=amt, illustrative=True))
    dep, days = (terms["deposit_pct"], terms["valid_days"]) if standard_terms else (None, None)
    return Estimate(
        id=est_id, service=service, areas=areas, scope_text=scope_text or [], line_items=items,
        subtotal=subtotal, province=province, tax_label=label, tax_rate=rate, tax=tax, total=subtotal + tax,
        deposit_pct=dep, deposit=((subtotal + tax) * dep / 100).quantize(CENT) if dep else None,
        valid_days=days, issued_on=issued_on, expires_on=issued_on + timedelta(days=days) if days else None,
        duration_text=duration_text,
        terms=([f"{dep}% deposit to book", f"Estimate valid {days} days", "Reconstruction not included"] if standard_terms else [])
              + (extra_terms or []),
        status=status, source=source)
