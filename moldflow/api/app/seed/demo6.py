"""The demo's 6 customers, all from real Mold Busters sample jobs (client names removed in the source, so customers carry a
place-based alias). 5 English, 1 French.

- Job 1 (Kanata on-site) and Job 2 (Montreal virtual assessment): the original sample pack (seeded in seeds.py).
- Smiths Falls, Laval, Pembroke, Stittsville: sample inspections vol 2.1. Real photos, job timelines, findings, estimates and
  the inspector's raw Telegram notes (as the project team chat). Customer text threads are reconstructed from each job's
  timeline (the wording is ours; the events, dates and amounts are the job's). Laval is project #42, the legal example.
Dates of the text threads are shifted relative to the app clock so the demo always looks current."""
import json
import re
from datetime import datetime, time, timedelta
from pathlib import Path

from app import clock, config, crm_store as db, store
from app.agents.tasks import image_check
from app.engine import consent as consent_rules, geo
from app.models.crm import ChannelConsent, Consent, Contact, FactSource, Interaction, Message, Moment, Prefs, ProfileFact, PropertyRef
from app.models.passport import Case, ChatMessage, Customer, Event, Finding, Photo, Property

VOL2 = config.PACK_DIR.parent / "Mold_Busters_Hackathon_Sample_Inspections"
REL = "../Mold_Busters_Hackathon_Sample_Inspections/"  # photo paths are relative to PACK_DIR
geo.FSA.setdefault("K7A", (44.900, -76.020, "Smiths Falls"))
geo.FSA.setdefault("H7L", (45.600, -73.770, "Metro Montréal - Laval"))
geo.FSA.setdefault("K8A", (45.826, -77.110, "Pembroke"))
geo.FSA.setdefault("K2S", (45.262, -75.922, "City of Ottawa"))

# contact, alias, lang, type, folder, case id, project no, FSA, postal, street, city, room, stage, max photos
JOBS = [
    ("c-smiths", "Smiths Falls client (selling the house)", "en", "homeowner", "02_OnSite_Inspection_Smiths_Falls_ON", "smiths", 201,
     "K7A", "K7A 4V7", "31 Ross St E", "Smiths Falls", "Attic", "accepted", 10),
    ("c-laval", "Client de Laval (ancien propriétaire)", "fr", "homeowner", "03_OnSite_Inspection_Laval_QC", "case42", 42,
     "H7L", "H7L 6G3", "2575 rue de la Canardière", "Laval", "Attic", "accepted", 10),
    ("c-pembroke", "Pembroke client (home builder)", "en", "business", "04_Virtual_Assessment_Pembroke_ON", "pembroke", 203,
     "K8A", "K8A 6W3", "24 Stencells Rd", "Pembroke", "Basement", "quoted", 3),
    ("c-stitts", "Stittsville client (homeowner)", "en", "homeowner", "06_Virtual_Assessment_Stittsville_ON_Zendesk", "stitts", 204,
     "K2S", "K2S 1B9", "109 Stoney Pond Ct", "Stittsville", "Bathroom", "quoted", 2),
]

THREADS = {  # (who, days ago, text); the last customer text gets an AI draft waiting for approval
    "c-job1": [("out", 16, "Hi, it's Mold Busters. I sent you the estimate... text me if anything doesn't make sense."),
               ("out", 13, "Good news: 10% off your remediation if you book this week."),
               ("out", 11, "Checking in one last time. We also offer a post-remediation clearance report."),
               ("in", 10, "Sorry for the delay. Before we decide: where is the moisture actually coming from? The ERMI score scared us."),
               ("out", 10, "Your report points to the upstairs washrooms (failed shower slope, leaking tub faucet) and the disturbed attic insulation."),
               ("in", 4, "So the basement swab doesn't need anything? It was positive."),
               ("in", 1, "Also, does the estimate include fixing the tub faucet or just the mold part?")],
    "c-job2": [("in", 40, "Hi, booked the virtual assessment. The smell in my apartment won't go away even after deep cleaning."),
               ("out", 40, "Thanks for booking. Your call is tomorrow at 11:30; have the laundry, vents and oven area ready to show."),
               ("in", 39, "Done the call, thank you. My landlord says it's just dust in the vents."),
               ("out", 39, "Your report is on its way. Photos can't confirm mould; an air quality test would answer that."),
               ("in", 20, "I've had headaches and coughing since I moved in. Should I be worried?"),
               ("out", 20, "We can't give medical advice, so please check with a doctor. The air test checks what photos can't."),
               ("in", 2, "If I do the air test can I give the results to my landlord? He keeps ignoring me.")],
    "c-smiths": [("in", 30, "Hi, our home inspector found traces of mold, they think in the attic. Can someone come look?"),
                 ("out", 30, "Yes! A scope-of-work visit is $95 + tax. Booked for Thursday 2 PM."),
                 ("in", 28, "Thanks for coming. We expected a full home inspection like on your website though."),
                 ("out", 28, "Sorry for the confusion. The $95 visit is a short diagnostic to price the work; the report and estimate follow."),
                 ("in", 22, "Got the report and estimate MO994. We're selling the house, can this be done before closing?"),
                 ("out", 22, "Yes, about 6-8 hours of work. We'll include a clearance report you can give the buyers."),
                 ("in", 19, "OK let's do it. What about the popcorn ceiling holes he mentioned?"),
                 ("out", 19, "Those may contain asbestos: keep them covered until they're tested. We can arrange the test."),
                 ("in", 1, "The buyers' lawyer is asking for proof the attic was done properly. What can you send?")],
    "c-laval": [("in", 66, "Bonjour, j'ai vendu ma maison. Les nouveaux propriétaires veulent une inspection du grenier."),
                ("out", 66, "Bonjour! Inspection visuelle et diagnostique: 195 $ + taxes, le 26 août à 13 h."),
                ("in", 59, "Merci pour l'inspection. J'avais vaporisé un produit anti-moisissure, je pensais que c'était réglé."),
                ("out", 59, "Il reste 3 petites zones près du ventilateur de la salle de bain; le test sur écouvillon est positif. Estimation MO881 envoyée."),
                ("in", 58, "D'accord, allez-y. Les nouveaux propriétaires veulent un rapport officiel."),
                ("out", 39, "Travaux terminés, le rapport de dégagement est prêt: test sur écouvillon négatif après traitement."),
                ("in", 2, "Les nouveaux propriétaires menacent de me poursuivre. Pouvez-vous m'envoyer tous les documents?")],
    "c-pembroke": [("in", 6, "I'm a homebuilder doing a 2 year warranty. Client is concerned about a storage room in the basement."),
                   ("out", 6, "Thanks! Your virtual inspection is booked for tomorrow 4:15 PM. Have the storage room and HVAC ready to show."),
                   ("in", 5, "Call done. Honestly I think it's just humidity, there's barely anything."),
                   ("out", 4, "Report and estimate MP370 sent: discoloration on the concrete and framing, humidity above range."),
                   ("in", 4, "Estimate accepted. Can you do it before the homeowners move their stuff back?"),
                   ("out", 4, "Yes. We'll confirm on site first, then about one day of work."),
                   ("in", 0, "Does the HVAC humidifier need to be shut off before you come?")],
    "c-stitts": [("in", 54, "Mold on ceiling in bathroom shower and around edge of bathtub where caulking is. Fan is used regularly."),
                 ("out", 54, "Thanks for the photos! I'm Bruce, Mold Busters' assistant. Want a free video call tomorrow at 9?"),
                 ("in", 54, "Yes 9 works."),
                 ("out", 51, "Estimate MO971 is in your inbox: remove the silicone, treat tiles, grout and the ceiling, about 4 hours."),
                 ("in", 33, "Thanks, it's a bit more than I expected. Let me think about it."),
                 ("out", 24, "No problem! Happy to answer any questions about the estimate."),
                 ("in", 1, "Can I just redo the caulking myself instead? Would that fix it?")],
}
DRAFTS = {
    "c-job1": "The estimate covers the mould work in the upstairs washrooms and attic; the tub faucet itself is a plumbing repair, so we'd recommend a plumber for that part.",
    "c-job2": "Yes, the air test results are yours to share, and they're the kind of evidence landlords and the city take seriously. Want us to book it?",
    "c-smiths": "We can send the inspection report, the clearance report after remediation and the paid invoice: together they document the attic work. Shall I email them?",
    "c-laval": "Bien sûr. Je vous envoie le rapport d'inspection, le rapport de dégagement (écouvillon négatif) et les factures; le propriétaire vous appellera aussi.",
    "c-pembroke": "Yes, please turn the humidifier off a day before so the basement can dry; we'll check its settings during the visit.",
    "c-stitts": "New caulking alone usually won't fix it: the growth is behind the old silicone and on the ceiling. Removing and treating it first is what stops it coming back.",
}
FACTS = {
    "c-job1": [("home", "Did a home ERMI test (score 13.2) and wants to know the source", "had done an ERMI test at home (score 13.2)", "light")],
    "c-job2": [("health", "Reported headaches and coughing since moving in", "I've had headaches and coughing since I moved in", "never")],
    "c-smiths": [("life_event", "Selling the house; needs the work done before closing", "We're selling the house, can this be done before closing?", "light")],
    "c-laval": [("life_event", "A vendu la maison; les nouveaux propriétaires demandent des documents", "j'ai vendu ma maison", "light")],
    "c-pembroke": [("work", "Home builder; this house is under his 2-year warranty", "I'm a homebuilder doing a 2 year warranty", "light")],
    "c-stitts": [("preference", "Finds the estimate a bit high; considering doing the caulking herself", "it's a bit more than I expected", "light")],
}
FOLLOWUPS = {
    "c-job1": (3, "Estimate still open: answer the faucet question and check if they want to book before it expires"),
    "c-job2": (5, "Offer to book the IAQ air test so she has results to share with her landlord"),
    "c-smiths": (1, "Send the buyers' lawyer the inspection report, clearance report and paid invoice"),
    "c-laval": (1, "Appel du propriétaire: envoyer le dossier complet (inspection, dégagement, factures) pour l'avocat"),
    "c-pembroke": (2, "Confirm the on-site visit date before the homeowners move their belongings back"),
    "c-stitts": (6, "Monthly follow-up on estimate MO971: offer a smaller scope (caulking + ceiling only)"),
}


def _when(text: str, year: int = 2026) -> datetime | None:
    m = re.search(r"([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?", text or "")
    if not m:
        return None
    try:
        return datetime.strptime(f"{m[1]} {m[2]} {m[3] or year} {m[4] or 10}:{m[5] or '00'}", "%b %d %Y %H:%M")
    except ValueError:
        return None


def _telegram(folder: Path) -> list[tuple[datetime | None, str]]:
    f = folder / "Raw_notes_from_Telegram.txt"
    if not f.is_file():
        return []
    head, *_ = f.read_text(encoding="utf-8").split("\n", 1)
    author = (re.search(r"inspector \(([^)]+)\)", head) or [None, "Inspector"])[1]
    out, day, cur = [], None, None
    for block in re.split(r"\n\[", "\n" + f.read_text(encoding="utf-8").split("\n\n", 1)[-1]):
        if "]" not in block:
            continue
        stamp, body = block.split("]", 1)
        if d := _when(stamp):
            day = d
        elif day and (t := re.match(r"(\d{1,2}):(\d{2})", stamp)):
            day = day.replace(hour=int(t[1]), minute=int(t[2]))
        body = re.sub(r"\n{2,}", "\n", body.strip())
        if body and not re.fullmatch(r"\(\d+ photos?\)", body):
            out.append((day, f"{author}: {body[:900]}"))
    return out


def _case(job) -> Case:
    cid, alias, lang, ctype, folder, case_id, no, fsa, postal, street, city, room, stage, maxp = job
    root = VOL2 / folder
    j = json.loads((root / "job_timeline.json").read_text(encoding="utf-8"))
    case = Case(id=case_id, project_no=no, title=f"{city} · {room} · {j['service'].split('(')[0].strip()}", stage=stage, language=lang,
                contact_id=cid, concern=j.get("client_concern", ""), seeded_from="sample inspections vol 2.1",
                customer=Customer(type=ctype, alias=alias), answers={"room": room, "concern": j.get("client_concern", "")[:300], "location": postal},
                property=Property(province="QC" if fsa[0] == "H" else "ON", postal_prefix=fsa, region_text=f"{street}, {city}", in_service_area=True,
                                  type="house"))
    case.intake_mode = "live" if "Virtual" in folder else "upload"
    photos = sorted(p for p in root.rglob("*.jpg"))
    for i, p in enumerate(photos[:maxp]):
        try:
            an = image_check(p.read_bytes(), lang)
        except Exception:
            an = None
        case.photos.append(Photo(id=f"v{i + 1:02d}", path=REL + p.relative_to(VOL2).as_posix(), room=room,
                                 source="customer" if case.intake_mode == "live" else "inspector",
                                 caption_from_pack=re.sub(r"^\d+_", "", p.stem).replace("_", " "), analysis=an,
                                 analysis_model="image check (on-server)", analysis_tier="rule"))
    for k, f in enumerate(j.get("findings", [])):
        ev = [case.photos[min(k, len(case.photos) - 1)].id] if case.photos else []
        if ev:
            case.findings.append(Finding(id=f"F{k + 1}", room=room, observation=f, evidence_photo_ids=ev, source="inspector_entered", confirmed=True))
    case.recommendations = j.get("recommendations", [])
    for t in j.get("timeline", []):
        when = _when(t.get("when_eastern", ""))
        case.timeline.append(Event(at=when, at_text=t.get("when_eastern", ""), step=t.get("step", ""), system=t.get("system", ""),
                                   what=t.get("what", ""), source="sample_pack"))
    est = j.get("estimate_summary") or {}
    if est:
        case.timeline.append(Event(at=None, at_text="Estimate", step=f"Estimate {est.get('number')}", system="FreshBooks",
                                   what=f"{est.get('amount')} · {est.get('status')} · " + "; ".join(est.get("scope", [])[:4]), source="sample_pack"))
    for at, text in _telegram(root):
        case.chat.append(ChatMessage(id=f"tg{len(case.chat):02d}", author=text.split(":", 1)[0], role="staff", text=text.split(":", 1)[1].strip(),
                                     at=at or clock.now(), source="telegram"))
    return case


def seed(cases: list[Case]) -> int:
    now, today = clock.now(), clock.today()
    contacts = {c.id: c for c in db.query(Contact)}
    for job in JOBS:
        cid, alias, lang, ctype, folder, case_id, no, fsa, postal, street, city, *_ = job
        if not (VOL2 / folder).is_dir():
            continue
        case = _case(job)
        store.save(case)
        lat, lon, _ = geo.FSA[fsa]
        est = json.loads((VOL2 / folder / "job_timeline.json").read_text(encoding="utf-8")).get("estimate_summary") or {}
        amount = float(re.sub(r"[^\d.]", "", (est.get("amount") or "0").split("=")[-1]) or 0)
        status = "accepted" if "ccepted" in (est.get("status") or "") else "viewed" if "iewed" in (est.get("status") or "") else "sent"
        purchase = ChannelConsent(basis="implied_purchase", granted_at=today - timedelta(days=40), granted_via="import", evidence_ref="paid visit",
                                  implied_until=consent_rules.implied_until("implied_purchase", today - timedelta(days=40)))
        contacts[cid] = Contact(id=cid, name=alias, phones=[f"(613) 555-{sum(map(ord, cid)) % 9000 + 1000}"], emails=[f"{case_id}@example.com"],
                                language=lang, customer_type=ctype, case_ids=[case_id], tags=["sample inspections vol 2.1"],
                                properties=[PropertyRef(address=street, city=city, postal=postal, fsa=fsa, lat=lat, lon=lon,
                                                        province="QC" if fsa[0] == "H" else "ON")],
                                consent=Consent(sms=purchase, email=purchase.model_copy(), profiling_notice_at=datetime.combine(today, time(9))),
                                prefs=Prefs(channel="sms"))
        if est:
            db.put(Interaction(id=f"i-{cid}-est", contact_id=cid, case_id=case_id, at=now - timedelta(days=20), system="freshbooks", kind="estimate",
                               summary=f"Estimate {est.get('number')}: {est.get('amount')} ({est.get('status')})", amount=amount,
                               meta={"status": status, "number": est.get("number")}))
    for c in cases:
        if c.id in ("job1", "job2") and (k := contacts.get(f"c-{c.id}")):
            k.name = "Kanata client (Job 1, homeowner)" if c.id == "job1" else "Montreal client (Job 2, tenant)"
    for cid, thread in THREADS.items():
        c = contacts.get(cid)
        if not c:
            continue
        case_id = c.case_ids[0] if c.case_ids else None
        last_in = None
        for k, (who, days, text) in enumerate(thread):
            at = now - timedelta(days=days, minutes=(len(thread) - k) * 7)
            m = Message(id=f"msg-{cid}-{k:02d}", contact_id=cid, case_id=case_id, channel="sms", direction=who, body=text, final_body=text,
                        language=c.language, trigger="inbound" if who == "in" else "inbound_reply", is_cem=False,
                        status="received" if who == "in" else "sent_simulated", drafted_by="staff" if who == "in" else "ai",
                        approved_by=None if who == "in" else "ai", created_at=at, sent_at=None if who == "in" else at)
            db.put(m, Interaction(id=f"i-{cid}-t{k:02d}", contact_id=cid, case_id=case_id, at=at, system="sms", kind=f"sms_{who}",
                                  summary=("Customer: " if who == "in" else "Mold Busters: ") + text[:160]))
            last_in = m if who == "in" else last_in
        if last_in and cid in DRAFTS:
            db.put(Message(id=f"msg-{cid}-draft", contact_id=cid, case_id=case_id, channel="sms", body=DRAFTS[cid], language=c.language,
                           trigger="inbound_reply", is_cem=False, status="draft", autonomy="draft", drafted_by="ai",
                           reason=f"Reply to: \"{last_in.body[:70]}\"", in_reply_to=last_in.id, created_at=now - timedelta(minutes=2)))
        for j, (cat, text, quote, use) in enumerate(FACTS.get(cid, [])):
            db.put(ProfileFact(id=f"f-{cid}-{j}", contact_id=cid, text=text, category=cat, source=FactSource(kind="sms", ref="text thread", quote=quote),
                               status="approved", message_use=use, extracted_by="rule", confidence=1.0, learned_at=now - timedelta(days=4 + j)))
        if cid in FOLLOWUPS:
            d, why = FOLLOWUPS[cid]
            db.put(Moment(id=f"m-{cid}-fu", contact_id=cid, kind="fact_follow_up", due=today + timedelta(days=d), reason=why, case_id=case_id))
        db.put(c)
    return len(contacts)
