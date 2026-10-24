"""Relationship hub: consent (CASL), geo matching, moments, fact grounding, guardrails, and the hero loop via the API."""
import os
import tempfile
from datetime import date, datetime, timedelta

import pytest

from app import clock
from app.engine import consent, geo, moments
from app.models.agents import FactDraft
from app.models.crm import ChannelConsent, Consent, Contact, FactSource, Interaction, Message, ProfileFact, PropertyRef


def _contact(**kw) -> Contact:
    base = dict(id="c1", name="Test Person", phones=["(613) 555-0000"], emails=["t@example.com"])
    base.update(kw)
    return Contact(**base)


def _msg(**kw) -> Message:
    base = dict(id="m1", contact_id="c1", channel="sms", body="hi", trigger="estimate_chase")
    base.update(kw)
    return Message(**base)


# ---------------- CASL consent
def test_implied_consent_windows():
    d = date(2026, 1, 1)
    assert consent.implied_until("implied_purchase", d) == d + timedelta(days=730)
    assert consent.implied_until("implied_inquiry", d) == d + timedelta(days=183)
    assert consent.implied_until("express", d) is None


def test_cem_blocked_without_consent_and_after_expiry(monkeypatch):
    monkeypatch.setattr(consent, "in_quiet_hours", lambda c, at=None: False)
    c = _contact()
    assert consent.check(c, _msg(), [], False)[0] == "block"
    c.consent.sms = ChannelConsent(basis="implied_purchase", granted_at=date(2023, 1, 1), implied_until=date(2025, 1, 1))
    decision, why = consent.check(c, _msg(), [], False)
    assert decision == "block" and "expired" in why
    c.consent.sms = ChannelConsent(basis="express", granted_at=date(2026, 1, 1))
    assert consent.check(c, _msg(), [], False)[0] == "send"


def test_safety_message_needs_no_marketing_consent_but_only_once(monkeypatch):
    monkeypatch.setattr(consent, "in_quiet_hours", lambda c, at=None: False)
    c = _contact()
    safety = _msg(trigger="storm_safety", is_cem=False, trigger_ref="a1")
    assert consent.check(c, safety, [], False)[0] == "send"
    sent = _msg(id="m0", trigger="storm_safety", is_cem=False, trigger_ref="a1", status="sent_simulated", sent_at=clock.now())
    assert consent.check(c, safety, [sent], False)[0] == "block"


def test_opt_out_suppression_dnc_and_cap(monkeypatch):
    monkeypatch.setattr(consent, "in_quiet_hours", lambda c, at=None: False)
    c = _contact(consent=Consent(sms=ChannelConsent(basis="express")))
    assert consent.check(c, _msg(), [], True)[0] == "block"
    c.do_not_contact = True
    assert consent.check(c, _msg(), [], False)[0] == "block"
    c.do_not_contact = False
    recent = _msg(id="m0", trigger="storm_offer", status="sent_simulated", sent_at=clock.now() - timedelta(days=2))
    decision, why = consent.check(c, _msg(trigger="moment:spring_melt"), [recent], False)
    assert decision == "block" and "frequency cap" in why


def test_life_event_needs_personalised_consent(monkeypatch):
    monkeypatch.setattr(consent, "in_quiet_hours", lambda c, at=None: False)
    c = _contact(consent=Consent(sms=ChannelConsent(basis="express")))
    m = _msg(trigger="moment:fact_follow_up", facts_used=["life:f1"])
    assert consent.check(c, m, [], False)[0] == "block"
    c.consent.personalised_reminders = True
    assert consent.check(c, m, [], False)[0] == "send"


def test_quiet_hours_hold():
    c = _contact(consent=Consent(sms=ChannelConsent(basis="express")))
    assert consent.in_quiet_hours(c, datetime(2026, 10, 24, 22, 30))
    assert consent.in_quiet_hours(c, datetime(2026, 10, 24, 7, 0))
    assert not consent.in_quiet_hours(c, datetime(2026, 10, 24, 13, 0))


def test_footer_has_identity_unsubscribe_and_ai_disclosure_in_both_languages():
    en = consent.footer(_msg(), ai_sent=True)
    fr = consent.footer(_msg(language="fr"), ai_sent=True)
    assert "Mold Busters" in en and "STOP" in en and "HUMAN" in en
    assert "ARRÊT" in fr and "HUMAIN" in fr
    assert "STOP" not in consent.footer(_msg(is_cem=False), ai_sent=False)


def test_keywords():
    assert consent.keyword("STOP") == "stop" and consent.keyword("arrêt.") == "stop"
    assert consent.keyword("Human") == "human" and consent.keyword("stop the leak please") is None


# ---------------- geo
def test_every_service_fsa_lands_in_its_real_forecast_zone():
    zones = geo.zones()
    for fsa, (lat, lon, zone) in geo.FSA.items():
        assert [n for n, g in zones.items() if geo.point_in_geometry(lat, lon, g)] == [zone], fsa


def test_multipolygon_and_holes():
    square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    hole = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]
    poly = {"type": "Polygon", "coordinates": [square, hole]}
    assert geo.point_in_geometry(2, 2, poly) and not geo.point_in_geometry(5, 5, poly)
    multi = {"type": "MultiPolygon", "coordinates": [[square], [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]]}
    assert geo.point_in_geometry(25, 25, multi) and not geo.point_in_geometry(15, 15, multi)
    assert geo.fsa_of("k1a 0b1") == "K1A" and geo.fsa_of("12345") is None and geo.locate("Z9Z 9Z9") is None


# ---------------- facts + guardrails
def test_health_fact_can_never_be_used_in_messages():
    f = ProfileFact(id="f", contact_id="c1", text="Son has asthma", category="health", message_use="light",
                    source=FactSource(kind="call", quote="my son has asthma"))
    assert f.message_use == "never"


def test_grounding_requires_verbatim_quote():
    from app.agents.hub import grounded
    src = "Thanks! Also we're expecting a baby in March."
    assert grounded(FactDraft(text="Expecting a baby", category="household", quote="we're expecting a baby in March"), src)
    assert not grounded(FactDraft(text="Has twins", category="household", quote="we have twins"), src)


def test_rule_fact_extraction():
    from app.agents.hub import _rule_facts
    facts = _rule_facts("ok let's do it. Also we're expecting a baby in March! I work nights at the hospital.")
    kinds = {f.category: f for f in facts}
    assert kinds["household"].text == "Expecting a baby in March" and kinds["household"].follow_up_month == 2
    assert "work" in kinds


def test_allowed_facts_filter():
    from app.agents.hub import allowed_facts
    c = _contact()
    mk = lambda i, cat, use="light", st="approved": ProfileFact(id=i, contact_id="c1", text=i, category=cat, message_use=use, status=st,  # noqa: E731
                                                                source=FactSource(kind="call", quote=i))
    facts = [mk("home", "home"), mk("kid", "household"), mk("asthma", "health"), mk("reno", "life_event"), mk("pend", "home", st="pending")]
    assert [f.id for f in allowed_facts(c, facts)] == ["home"]
    c.consent.personalised_reminders = True
    assert [f.id for f in allowed_facts(c, facts)] == ["home", "reno"]


# ---------------- moments
def test_moments_estimate_and_household_is_human_only():
    today = date(2026, 10, 24)
    c = _contact()
    est = Interaction(id="e", contact_id="c1", at=datetime(2026, 10, 7, 10), system="freshbooks", kind="estimate", summary="x", amount=4181.0,
                      meta={"status": "viewed", "number": "EST-1"})
    baby = ProfileFact(id="f", contact_id="c1", text="Expecting a baby in March", category="household", status="approved",
                       follow_up=date(2027, 2, 1), source=FactSource(kind="sms", quote="expecting a baby in March"))
    ms = {m.kind: m for m in moments.compute(c, [baby], [est], today)}
    assert ms["estimate_expiry"].due == date(2026, 11, 22)
    assert ms["nursery_humidity"].human_only


# ---------------- API hero loop (isolated data dir, no AI key: rule fallbacks)
@pytest.fixture()
def client(monkeypatch):
    tmp = tempfile.mkdtemp()
    from app import config
    monkeypatch.setattr(config, "DB_PATH", config.Path(tmp) / "t.db") if hasattr(config, "Path") else monkeypatch.setattr(config, "DB_PATH", os.path.join(tmp, "t.db"))
    monkeypatch.setattr(config, "OPENROUTER_API_KEY", "")
    monkeypatch.setattr(consent, "in_quiet_hours", lambda c, at=None: False)
    from app.agents import llm
    monkeypatch.setattr(llm, "_quota_until", 4102444800.0)  # behave as if the daily quota is used up: rules only
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        yield c


def test_hero_loop(client):
    r = client.post("/webhooks/inbound", json={"from_": "(613) 555-7788", "channel": "sms",
                                               "body": "I found black stuff on my basement wall. Is it dangerous? My son has asthma."}).json()
    assert r["reply"]["status"] == "sent_simulated" and "medical advice" in r["reply"]["body"]
    assert all(f["status"] == "pending" for f in r["facts"])
    chase = client.post("/people/c-job1/chase").json()
    assert chase["autonomy"] == "locked" and "washroom" in chase["body"] and "$4,181.00" in chase["body"]
    sent = client.post(f"/messages/{chase['id']}/approve", json={"by": "Staff E"}).json()
    assert sent["status"] == "sent_simulated" and "STOP" in sent["final_body"]
    r = client.post("/webhooks/inbound", json={"contact_id": "c-job1", "channel": "sms",
                                               "body": "ok let's do it. Also we're expecting a baby in March!"}).json()
    assert r["accepted"]["amount"] == 4181.0
    baby = next(f for f in r["facts"] if "baby" in f["text"])
    client.post(f"/facts/{baby['id']}/approve")
    person = client.get("/people/c-job1").json()
    assert any(m["kind"] == "nursery_humidity" and m["human_only"] for m in person["moments"])
    alert = client.post("/alerts/simulate", json={"zone": "Gatineau"}).json()
    assert alert["matched"] and alert["matched"][0]["priority"] == 1
    made = client.post(f"/alerts/{alert['alert']['id']}/draft").json()
    assert made["offer"] + made["safety"] > 0
    fr = [m for m in client.get("/messages?status=draft").json() if m["message"]["trigger"].startswith("storm") and m["message"]["language"] == "fr"]
    assert fr and "pluie" in fr[0]["message"]["body"]
    hub = client.get("/hub").json()
    assert hub["money"]["recovered_total"] == 4181.0 and hub["money"]["funnel"]["accepted"] == 1


def test_stop_and_human_keywords(client):
    client.post("/webhooks/inbound", json={"contact_id": "c-job1", "channel": "sms", "body": "STOP"})
    m = client.post("/people/c-job1/chase").json()
    assert client.post(f"/messages/{m['id']}/approve", json={"by": "x"}).json()["status"] == "blocked"
    client.post("/webhooks/inbound", json={"contact_id": "c-job2", "channel": "sms", "body": "human"})
    assert client.get("/people/c-job2").json()["contact"]["owner"].startswith("human")


def test_kill_switch_holds_everything(client):
    client.post("/settings/pause", json={"paused": True})
    m = client.post("/people/c-job1/chase").json()
    out = client.post(f"/messages/{m['id']}/approve", json={"by": "x"}).json()
    assert out["status"] == "draft" and "paused" in out["blocked_reason"].lower()


def _book(client, consent_box: bool, phone: str):
    cid = client.post("/cases", json={"language": "en"}).json()["case"]["id"]
    av = client.get("/booking/availability").json()
    day = next(d for d in av["days"] if d["slots"])
    r = client.post(f"/cases/{cid}/book", json={"service": "onsite", "customer_type": "homeowner", "slot_date": day["date"], "slot_time": day["slots"][0],
                                                "marketing_consent": consent_box, "notes": "We've got a big dog, use the side door. Text me after five please.",
                                                "contact": {"name": "Ana Lima", "phone": phone, "email": "", "address": "1 Main St", "city": "Ottawa", "postal_code": "K1S 2B3"}})
    assert r.status_code == 200, r.text
    return r.json()["case"]


def test_booking_creates_contact_with_exact_consent(client):
    case = _book(client, True, "(613) 555-4040")
    p = client.get(f"/people/{case['contact_id']}").json()
    assert p["contact"]["consent"]["sms"]["basis"] == "express" and p["contact"]["consent"]["profiling_notice_at"]
    assert p["contact"]["properties"][0]["fsa"] == "K1S" and p["contact"]["properties"][0]["lat"]
    assert any("dog" in f["text"].lower() for f in p["facts"])


def test_booking_without_box_is_only_implied_inquiry(client):
    case = _book(client, False, "(613) 555-5050")
    c = client.get(f"/people/{case['contact_id']}").json()["contact"]
    assert c["consent"]["sms"]["basis"] == "implied_inquiry" and c["consent"]["sms"]["implied_until"]


def test_research_brief_only_from_reference():
    from app.routers.hub import BriefIn, research_brief
    r = research_brief(BriefIn(lab_text="Lab: Stachybotrys detected on drywall"))
    assert r["found"] == ["Stachybotrys"] and "long-term water damage" in r["brief"] and "medical advice" in r["brief"]
    assert len({s["url"] for s in r["sources"]}) == len(r["sources"])
    assert research_brief(BriefIn(lab_text="black stuff in a photo"))["found"] == []
