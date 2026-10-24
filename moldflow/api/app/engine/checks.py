"""Deterministic validation: evidence completeness, scope consistency, estimate math, offers.
Flag ids are stable so a re-run preserves human resolutions."""
import hashlib
import re

from app.models.passport import CENT, Case, Flag

STRONG = {"positive", "elevated", "failed"}   # objective evidence -> scope gap is a BLOCK
WEAK = {"anomaly"}                            # clues (thermal / visual) -> scope gap is a WARN


def _fid(*parts: str) -> str:
    return "f_" + hashlib.sha1("|".join(parts).encode()).hexdigest()[:10]


def _evidence_rooms(case: Case) -> dict[str, tuple[str, list[str]]]:
    """room -> (strongest level, refs)"""
    rooms: dict[str, tuple[str, list[str]]] = {}
    for f in case.findings:
        results = {r.result for r in f.readings}
        level = "strong" if results & STRONG else "weak" if results & WEAK else None
        if not level:
            continue
        prev = rooms.get(f.room)
        refs = (prev[1] if prev else []) + [f.id]
        rooms[f.room] = ("strong" if level == "strong" or (prev and prev[0] == "strong") else "weak", refs)
    return rooms


def completeness(case: Case) -> list[Flag]:
    out = []
    photo_ids = {p.id for p in case.photos}
    for f in case.findings:
        missing = [pid for pid in f.evidence_photo_ids if pid not in photo_ids]
        if missing:
            out.append(Flag(id=_fid("cmp_photo", f.id), check="completeness", severity="block",
                            message=f"Finding '{f.observation[:60]}' cites photos that don't exist: {', '.join(missing)}", refs=[f.id]))
        if not f.confirmed:
            out.append(Flag(id=_fid("cmp_unconfirmed", f.id), check="completeness", severity="warn",
                            message=f"AI-structured finding not yet confirmed by the inspector: '{f.observation[:70]}'", refs=[f.id]))
    for room in sorted({f.room for f in case.findings}):
        kinds = {r.kind for f in case.findings if f.room == room for r in f.readings}
        if "moisture" not in kinds and "temp_rh_dew" not in kinds and room.lower() != "exterior":
            out.append(Flag(id=_fid("cmp_moist", room), check="completeness", severity="info",
                            message=f"{room}: no moisture or humidity reading recorded (shown as 'not recorded' in the report).", refs=[]))
    return out


def scope(case: Case) -> list[Flag]:
    est = case.estimate
    if not est or est.service != "remediation":
        return []
    out, areas = [], set(est.areas)
    for room, (level, refs) in _evidence_rooms(case).items():
        if room in areas:
            continue
        if level == "strong":
            out.append(Flag(id=_fid("scope", room), check="scope", severity="block", refs=refs,
                            message=f"{room}: positive/elevated evidence was recorded, but {room.lower()} is not in the estimate scope. "
                                    "Confirm the exclusion is intentional (and explain it to the customer) or add it."))
        else:
            out.append(Flag(id=_fid("scope_weak", room), check="scope", severity="warn", refs=refs,
                            message=f"{room}: anomalies noted but not in the estimate scope. Make sure the report explains the referral or follow-up."))
    concern = case.concern.lower()
    for room in {f.room for f in case.findings}:
        if room.lower().split()[0] in concern and room not in areas:
            out.append(Flag(id=_fid("concern", room), check="scope", severity="warn", refs=[],
                            message=f"The customer's original concern was the {room.lower()}, which is not in the proposed scope. "
                                    "The report should say plainly what was found there and why it's excluded."))
    return out


def estimate(case: Case) -> list[Flag]:
    est = case.estimate
    if not est:
        return []
    out = []
    if case.property.province not in ("ON", "QC"):
        out.append(Flag(id=_fid("est_prov"), check="estimate", severity="block", refs=[est.id],
                        message="Province is unknown or conflicting, so the tax rate can't be confirmed. Resolve the address first."))
    elif est.province != case.property.province:
        out.append(Flag(id=_fid("est_prov_mismatch"), check="estimate", severity="block", refs=[est.id],
                        message=f"Estimate taxed for {est.province} but the property is in {case.property.province}."))
    tax = (est.subtotal * est.tax_rate).quantize(CENT)
    ok = tax == est.tax and est.subtotal + tax == est.total
    out.append(Flag(id=_fid("est_math"), check="estimate", severity="info" if ok else "block", refs=[est.id],
                    message=(f"Math verified: ${est.subtotal} + {est.tax_label} ${est.tax} = ${est.total}"
                             + (f"; {est.deposit_pct}% deposit ${est.deposit}" if est.deposit else "")
                             + (f"; valid until {est.expires_on.isoformat()}" if est.expires_on else "") + ".") if ok
                    else "Estimate totals do not reconcile."))
    if any(li.illustrative for li in est.line_items):
        out.append(Flag(id=_fid("est_illus"), check="estimate", severity="info", refs=[est.id],
                        message="Line-item split is an illustrative placeholder; Mold Busters sets real unit pricing."))
    return out


OFFER_RE = re.compile(r"(\d+\s?%|discount|rabais|% off|coupon|promo)", re.I)


def offer_check(body: str, uses_token: bool) -> list[str]:
    if uses_token:
        return []
    return ["Draft mentions a discount/offer that wasn't approved by staff. Remove it or insert an approved {offer}."] if OFFER_RE.search(body) else []


def run_all(case: Case) -> list[Flag]:
    """Recompute computed flags, keeping record-conflict flags and preserving resolutions."""
    previous = {f.id: f for f in case.flags}
    keep = [f for f in case.flags if f.check in ("record_conflict", "guardrail", "offer")]
    fresh = completeness(case) + scope(case) + estimate(case)
    for f in fresh:
        if (p := previous.get(f.id)) and p.resolved:
            f.resolved, f.resolution_note, f.resolved_by = True, p.resolution_note, p.resolved_by
    order = {"block": 0, "warn": 1, "info": 2}
    return sorted(keep + fresh, key=lambda f: (f.resolved, order[f.severity]))
