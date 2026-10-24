"""Seed the relationship hub: the 2 real sample-pack customers + 28 SYNTHETIC customers (labelled as such everywhere).

Synthetic people are invented for the demo: names, phones (555 numbers), emails (example.com) and their histories in the
company's tools (Google Calendar, FreshBooks, Asana, Close, Brain, Dialpad, email). Facts carry the quote they came from,
as if extracted from calls/texts, so the hub works with zero AI calls. Dates are relative to the app clock."""
import random
from datetime import datetime, time, timedelta

from app import clock, crm_store as db
from app.engine import consent as consent_rules
from app.engine import geo
from app.models.crm import ChannelConsent, Consent, Contact, FactSource, Interaction, Prefs, ProfileFact, PropertyRef
from app.models.passport import Case

SYSTEM_MAP = {"google calendar": "google_calendar", "freshbooks": "freshbooks", "asana": "asana", "close": "close", "brain": "brain",
              "dialpad": "dialpad", "email": "email", "on site": "moldflow", "booking page": "google_calendar", "mold busters virtual": "moldflow"}

# name, language, type, FSA, street, city
PEOPLE = [
    ("Marie Tremblay", "fr", "homeowner", "J8X", "48 rue Laurier", "Gatineau"),
    ("Daniel Okafor", "en", "homeowner", "K1S", "212 Fifth Ave", "Ottawa"),
    ("Sophie Gagnon", "fr", "homeowner", "J8Y", "15 rue Wellington", "Gatineau"),
    ("Priya Raman", "en", "homeowner", "K2K", "77 Terry Fox Dr", "Ottawa"),
    ("Jean-Luc Bouchard", "fr", "landlord", "J8Z", "301 boul. de la Cité", "Gatineau"),
    ("Emily Chen", "en", "homeowner", "K1Y", "9 Hamilton Ave N", "Ottawa"),
    ("Robert Lavoie", "fr", "homeowner", "J9A", "120 rue Principale", "Gatineau"),
    ("Aisha Mohamed", "en", "tenant", "K1G", "1840 Russell Rd", "Ottawa"),
    ("Michel Pelletier", "fr", "homeowner", "J8T", "56 rue Notre-Dame", "Gatineau"),
    ("Hannah Schultz", "en", "homeowner", "K2B", "33 Britannia Rd", "Ottawa"),
    ("Luc Côté", "fr", "property_manager", "H2X", "1200 rue Saint-Urbain", "Montréal"),
    ("Grace Liu", "en", "homeowner", "K4A", "4 Tenth Line Rd", "Ottawa"),
    ("Isabelle Roy", "fr", "homeowner", "H2T", "4480 rue Saint-Denis", "Montréal"),
    ("Tom Bennett", "en", "homeowner", "K2G", "18 Greenbank Rd", "Ottawa"),
    ("Nadia Haddad", "fr", "tenant", "H4A", "5600 av. Monkland", "Montréal"),
    ("Carlos Mendes", "en", "homeowner", "K1V", "2600 Riverside Dr", "Ottawa"),
    ("Chantal Fortin", "fr", "homeowner", "H7N", "250 boul. Cartier", "Laval"),
    ("Kevin O'Brien", "en", "business", "K1P", "150 Elgin St", "Ottawa"),
    ("Mei Tanaka", "en", "homeowner", "M4C", "880 Danforth Ave", "Toronto"),
    ("André Girard", "fr", "homeowner", "J8P", "73 rue Saint-Louis", "Gatineau"),
    ("Fatima Benali", "fr", "homeowner", "H7T", "3030 boul. Le Carrefour", "Laval"),
    ("James Wilson", "en", "landlord", "M6P", "2120 Dundas St W", "Toronto"),
    ("Olivia Martin", "en", "homeowner", "K2M", "41 Castlefrank Rd", "Ottawa"),
    ("Pierre Dubois", "fr", "homeowner", "J9H", "18 ch. d'Aylmer", "Gatineau"),
    ("Sarah Goldberg", "en", "homeowner", "M5R", "60 Avenue Rd", "Toronto"),
    ("Yves Bergeron", "fr", "homeowner", "H1A", "12000 rue Sherbrooke E", "Montréal"),
    ("Linda Park", "en", "homeowner", "K1J", "1500 Ogilvie Rd", "Ottawa"),
    ("Marc-André Leblanc", "fr", "homeowner", "J8X", "92 rue Eddy", "Gatineau"),
]

# (category, fact text, customer quote, source kind, message_use, follow-up (month, day) or None, follow-up reason, status)
FACTS = [
    ("household", "School-age child starting grade 1 this fall", "our daughter starts grade 1 in September", "call", "never", (8, 20), "back to school: ask how the new routine is going, offer a bedroom humidity check", "approved"),
    ("life_event", "Renovating the basement next spring", "we're finishing the basement in the spring", "call", "light", (3, 1), "before the basement renovation: moisture check before drywall goes up", "approved"),
    ("home", "House built in 1978, original windows", "the house is from '78, still the original windows", "bruce", "light", None, None, "approved"),
    ("preference", "Prefers texts after 5 pm (works days)", "text me after five, I'm at work all day", "sms", "light", None, None, "approved"),
    ("health", "Son has asthma", "my son has asthma so I worry about the air", "call", "never", None, None, "approved"),
    ("home", "Large dog at home; keep the side gate closed", "we've got a big dog, just keep the side gate closed", "call", "never", None, None, "approved"),
    ("life_event", "Planning to sell the house next year", "we're thinking of listing it next summer", "email", "light", (4, 1), "pre-listing inspection before they list", "approved"),
    ("home", "Sump pump replaced two years ago", "we put in a new sump pump two years ago", "note", "light", None, None, "approved"),
    ("household", "Expecting a baby in the spring", "we're expecting our first baby in April", "sms", "never", (3, 1), "nursery humidity check a month before the due date (human call, not an automated text)", "pending"),
    ("work", "Works night shifts at the hospital", "I'm on nights at the Civic most weeks", "call", "never", None, None, "approved"),
    ("home", "Basement flooded in the 2019 spring melt", "we had water in the basement back in 2019", "bruce", "light", None, None, "approved"),
    ("preference", "Wants reports by email, not paper", "just email me everything, no paper please", "email", "light", None, None, "approved"),
]

ESTIMATE_STATES = ["accepted", "viewed", "viewed", "sent", "accepted", "declined", None, None]


def _consent(rng: random.Random, i: int, last_purchase: datetime | None, inquiry: datetime) -> Consent:
    today = clock.today()
    mode = i % 5
    if mode == 0:
        sms = ChannelConsent(basis="express", granted_at=(inquiry.date()), granted_via="web_form", evidence_ref=f"form-{i:03d}", text_version="2026-10-v1")
    elif last_purchase and mode in (1, 2):
        sms = ChannelConsent(basis="implied_purchase", granted_at=last_purchase.date(),
                             implied_until=consent_rules.implied_until("implied_purchase", last_purchase.date()), granted_via="import",
                             evidence_ref=f"FreshBooks INV-S{i:03d}")
    elif mode == 3:
        old = today - timedelta(days=900)
        sms = ChannelConsent(basis="implied_purchase", granted_at=old, implied_until=consent_rules.implied_until("implied_purchase", old),
                             granted_via="import", evidence_ref=f"FreshBooks INV-S{i:03d} (2024)")
    else:
        sms = ChannelConsent()
    email = sms.model_copy()
    return Consent(sms=sms, email=email, personalised_reminders=(mode == 0), profiling_notice_at=inquiry if mode == 0 else None)


def _real_contacts(cases: list[Case]) -> list[tuple[Contact, list[Interaction]]]:
    out = []
    plan = {"job1": ("Sample Client 01 (homeowner)", "en", "K2G", "Sample Property 01", "Ottawa", "homeowner"),
            "job2": ("Sample Client 02 (tenant)", "en", "J8X", "Sample Property 02", "Gatineau", "tenant")}
    for case in cases:
        if case.id not in plan:
            continue
        name, lang, fsa, street, city, ctype = plan[case.id]
        lat, lon, _ = geo.FSA[fsa]
        inter = []
        for k, e in enumerate(case.timeline):
            sysname = next((v for key, v in SYSTEM_MAP.items() if key in e.system.lower()), "moldflow")
            inter.append(Interaction(id=f"i-{case.id}-{k:02d}", contact_id=f"c-{case.id}", case_id=case.id, at=e.at or clock.now(),
                                     system=sysname, kind=e.step.lower().replace(" ", "_"), summary=e.what))
        est = case.estimate
        meta = {"status": "viewed", "number": est.id} if est else {}
        if est:
            inter.append(Interaction(id=f"i-{case.id}-est", contact_id=f"c-{case.id}", case_id=case.id,
                                     at=datetime.combine(est.issued_on, time(10)), system="freshbooks", kind="estimate",
                                     summary=f"Estimate {est.id}: ${est.total} ({est.real_world_status})", amount=float(est.total), meta=meta))
        issued = est.issued_on if est else clock.today()
        c = Contact(id=f"c-{case.id}", name=name, phones=[f"(613) 555-01{10 + len(out):02d}"], emails=[f"{case.id}@example.com"],
                    language=lang, customer_type=ctype,
                    properties=[PropertyRef(address=street, city=city, postal=f"{fsa} (sample: postal code not in the pack)", fsa=fsa, lat=lat, lon=lon,
                                            province="ON" if fsa[0] == "K" else "QC")],
                    case_ids=[case.id], tags=["sample pack"],
                    consent=Consent(sms=ChannelConsent(basis="implied_inquiry", granted_at=issued, granted_via="import",
                                                       implied_until=consent_rules.implied_until("implied_inquiry", issued),
                                                       evidence_ref=f"{case.id} booking + paid inspection")),
                    prefs=Prefs(storm_checkin_opt_in=case.id == "job2"))
        # paid inspection = a purchase -> implied consent for 2 years (CASL s.10(9)(a))
        c.consent.sms = ChannelConsent(basis="implied_purchase", granted_at=issued, implied_until=consent_rules.implied_until("implied_purchase", issued),
                                       granted_via="import", evidence_ref=f"FreshBooks invoice for the {case.id} inspection")
        c.consent.email = c.consent.sms.model_copy()
        out.append((c, inter))
    return out


def seed(cases: list[Case]) -> dict:
    rng = random.Random(42)
    today = clock.today()
    contacts, facts, inters = [], [], []
    for c, inter in _real_contacts(cases):
        contacts.append(c)
        inters += inter
    job1 = next((x for x in contacts if x.id == "c-job1"), None)
    if job1:
        facts.append(ProfileFact(id="f-job1-ermi", contact_id=job1.id, text="Did a home ERMI test (score 13.2) and wants to know the source",
                                 category="home", source=FactSource(kind="booking", ref="job1 calendar note", quote="had done an ERMI test at home (score 13.2)"),
                                 status="approved", message_use="light", extracted_by="rule", confidence=1.0,
                                 learned_at=datetime(2026, 10, 1, 10, 0)))
    job2 = next((x for x in contacts if x.id == "c-job2"), None)
    if job2:
        facts.append(ProfileFact(id="f-job2-health", contact_id=job2.id, text="Reported health issues while living in the unit", category="health",
                                 source=FactSource(kind="bruce", ref="job2 video call", quote="Client reported health issues while living in the unit"),
                                 status="approved", extracted_by="rule", confidence=1.0,
                                 learned_at=datetime(2025, 9, 8, 11, 30)))
    for i, (name, lang, ctype, fsa, street, city) in enumerate(PEOPLE):
        cid = f"c-s{i:02d}"
        lat, lon, _ = geo.FSA[fsa]
        first_contact = datetime.combine(today - timedelta(days=rng.randint(40, 700)), time(rng.randint(9, 17), rng.choice([0, 15, 30, 45])))
        inspected = first_contact + timedelta(days=rng.randint(3, 9))
        state = ESTIMATE_STATES[i % len(ESTIMATE_STATES)]
        amount = rng.choice([1850, 2400, 3150, 3700, 4900, 6200, 520, 2950])
        # 3 estimates are recent and at risk (viewed, not accepted) so the money funnel is live on day one
        if state == "viewed":
            inspected = datetime.combine(today - timedelta(days=rng.randint(9, 25)), time(11))
        purchase = inspected if state in ("accepted",) or i % 3 == 0 else (inspected if i % 2 == 0 else None)
        consent = _consent(rng, i, purchase, first_contact)
        slug = name.lower().replace(" ", ".").replace("'", "").replace("é", "e").replace("è", "e").replace("ô", "o").replace("ç", "c")
        c = Contact(id=cid, name=name, phones=[f"({'819' if fsa[0] == 'J' else '514' if fsa[0] == 'H' else '416' if fsa[0] == 'M' else '613'}) 555-{1000 + i * 37:04d}"],
                    emails=[f"{slug}@example.com"], language=lang, customer_type=ctype,
                    properties=[PropertyRef(address=street, city=city, postal=f"{fsa} {rng.randint(1, 9)}{chr(65 + i % 20)}{rng.randint(1, 9)}", fsa=fsa,
                                            lat=lat, lon=lon, province="ON" if fsa[0] in "KM" else "QC")],
                    consent=consent, prefs=Prefs(storm_checkin_opt_in=(i % 3 == 0), channel="email" if i % 7 == 3 else "sms"),
                    synthetic=True, tags=["synthetic demo data"])
        contacts.append(c)
        sysrows = [
            (first_contact, "dialpad", "call", f"Inbound call: {['musty smell in basement', 'black spots on bathroom ceiling', 'water stain after a leak', 'attic frost and stains', 'smell in the laundry room'][i % 5]}"),
            (first_contact + timedelta(hours=1), "google_calendar", "booking", "Inspection booked (MB - Ottawa-Gatineau)" if fsa[0] in "KJ" else "Inspection booked (MB - Montréal/Toronto)"),
            (inspected, "moldflow", "inspection", "On-site inspection completed, 18 photos"),
            (inspected + timedelta(days=1), "freshbooks", "invoice", "Inspection invoice paid: $220.35"),
            (inspected + timedelta(days=1, hours=2), "asana", "card", "Job card: Share Deliverables -> Follow Up"),
            (inspected + timedelta(days=2), "email", "report_sent", "Report emailed with estimate link"),
        ]
        for k, (at, sysname, kind, summary) in enumerate(sysrows):
            inters.append(Interaction(id=f"i-{cid}-{k}", contact_id=cid, at=at, system=sysname, kind=kind, summary=summary, synthetic=True,
                                      amount=220.35 if kind == "invoice" else None))
        if state:
            inters.append(Interaction(id=f"i-{cid}-est", contact_id=cid, at=inspected + timedelta(days=1, hours=1), system="freshbooks", kind="estimate",
                                      summary=f"Remediation estimate EST-S{i:02d}: ${amount * 1.13:,.2f}", amount=round(amount * 1.13, 2),
                                      meta={"status": state, "number": f"EST-S{i:02d}"}, synthetic=True))
            if state == "viewed":
                for d, txt in ((2, "I sent you the estimate... text me if anything doesn't make sense."), (5, "Checking in on your estimate.")):
                    inters.append(Interaction(id=f"i-{cid}-close{d}", contact_id=cid, at=inspected + timedelta(days=d), system="close", kind="sms_out",
                                              summary=f"Canned sequence SMS: \"{txt}\"", synthetic=True))
        for j in range(2 if i % 4 else 3):
            cat, text, quote, kind, use, fu, why, status = FACTS[(i * 3 + j) % len(FACTS)]
            if j == 0 and i in (1, 7, 13, 19):  # a few facts still waiting for staff review on day one
                status = "pending"
            follow = None
            if fu:
                follow = today.replace(month=fu[0], day=fu[1])
                if follow < today:
                    follow = follow.replace(year=today.year + 1)
            facts.append(ProfileFact(id=f"f-{cid}-{j}", contact_id=cid, text=text, category=cat,
                                     source=FactSource(kind=kind, ref=f"{kind} on {first_contact.date().isoformat()}", quote=quote),
                                     learned_at=first_contact + timedelta(days=j), confidence=0.9, status=status, message_use=use,
                                     follow_up=follow, follow_up_reason=why, expires_at=today + timedelta(days=3 * 365), extracted_by="ai"))
    db.put(*contacts, *facts, *inters)
    db.kv_set("seeded_at", clock.now().isoformat())
    return {"contacts": len(contacts), "facts": len(facts), "interactions": len(inters)}


def seed_todays_visits(save_case) -> list[str]:
    """Three synthetic inspections booked for 'today' (app clock) so the day sheet and the hub's Today box have content."""
    from app.models.passport import Booking, BookingContact, Customer, Property
    plan = [("c-s01", "9:00 AM", "Musty smell in the finished basement, worse after rain", "Basement", "Park in the driveway; side door is unlocked."),
            ("c-s06", "11:30 AM", "Black spots on the bathroom ceiling above the shower", "Bathroom", "Ring twice, the doorbell is quiet."),
            ("c-s13", "2:00 PM", "Water stain on the bedroom ceiling after an ice dam", "Bedroom", "Street parking only; attic hatch is in the hallway closet.")]
    ids = []
    for cid, slot, concern, room, access in plan:
        c = db.get(Contact, cid)
        if not c:
            continue
        p = c.properties[0]
        case = Case(id=f"visit-{cid}", title=f"Inspection: {c.name}", stage="inspection_booked", language=c.language, contact_id=cid,
                    customer=Customer(type=c.customer_type, alias=c.name), concern=concern, answers={"room": room, "concern": concern},
                    property=Property(province=p.province, postal_prefix=p.fsa, region_text=f"{p.address}, {p.city}"),
                    booking=Booking(service="onsite", slot_text=f"Today {slot}", status="confirmed_simulated", slot_date=clock.today(), slot_time=slot,
                                    timezone="America/Toronto", customer_type=c.customer_type,
                                    contact=BookingContact(name=c.name, phone=c.phones[0], email=c.emails[0] if c.emails else "", address=p.address,
                                                           city=p.city, postal_code=p.postal), notes=access),
                    seeded_from="synthetic demo data")
        save_case(case)
        c.case_ids.append(case.id)
        db.put(c, Interaction(id=f"i-{case.id}-book", contact_id=cid, case_id=case.id, at=clock.now() - timedelta(days=3), system="google_calendar",
                              kind="booking", summary=f"Inspection booked for today {slot}: {concern}", synthetic=True))
        ids.append(case.id)
    return ids
