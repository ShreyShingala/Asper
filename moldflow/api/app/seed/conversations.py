"""Customer text conversations for the 8 synthetic demo customers (labelled synthetic everywhere).

Each thread is about the customer's OWN case. The last customer message is unanswered and has an AI-drafted reply waiting
in the Outreach queue, so the demo shows: customer texts -> AI drafts from their case + the conversation -> admin
approves or denies. These threads are also context for Muse and for future automatic replies."""
from datetime import timedelta

from app import clock, crm_store as db
from app.models.crm import Contact, Interaction, Message
from app.models.passport import Booking, BookingContact, Case, Customer, Property

# contact id -> (room, concern, stage, visit (days from today, time) or None, thread [(who, minutes ago, text)], AI draft reply, reason)
THREADS: dict[str, tuple] = {
    "c-s00": ("Bathroom", "Black spots on the bathroom ceiling above the shower", "inspection_booked", (2, "10:00 AM"), [
        ("in", 2900, "Bonjour, j'ai des points noirs au plafond de la salle de bain, au-dessus de la douche."),
        ("out", 2895, "Bonjour Marie, merci! Pouvez-vous nous montrer l'endroit en 3 minutes? Vous pouvez aussi réserver une visite: moldbusters.ca/b"),
        ("in", 2700, "J'ai réservé pour jeudi 10 h."),
        ("out", 2698, "Parfait, c'est confirmé pour jeudi 10 h. Le technicien vous texte 30 minutes avant."),
        ("in", 35, "Est-ce que je peux continuer à prendre ma douche d'ici jeudi? Le ventilateur fait un drôle de bruit."),
    ], "Oui, vous pouvez continuer. Laissez le ventilateur tourner 20 minutes après la douche et entrouvrez la porte. Nous vérifierons le ventilateur jeudi à 10 h.",
       "Question about her booked visit: shower use and the fan"),
    "c-s01": ("Basement", "Musty smell in the finished basement, worse after rain", "quoted", None, [
        ("in", 9000, "The inspector was great. Got the estimate, thanks."),
        ("out", 8990, "Thanks Daniel! Any questions on the estimate, just text here."),
        ("in", 120, "Does the estimate include the drywall behind the furnace? That's where the smell is worst."),
    ], "Good question. The estimate covers the north wall and the area behind the furnace (removal of the lower drywall and treatment). "
       "If you'd like, I can have the inspector call you to walk through it.", "Question about what his estimate covers"),
    "c-s02": ("Attic", "Frost and dark marks on the attic roof boards after a cold snap", "inspection_booked", (1, "2:00 PM"), [
        ("in", 1500, "Bonjour, du givre et des taches noires dans l'entretoit."),
        ("out", 1495, "Merci Sophie. Visite confirmée demain 14 h. L'accès à l'entretoit est-il dans un placard?"),
        ("in", 60, "Oui, dans le placard du couloir. Il arrive à quelle heure exactement?"),
    ], "Votre visite est prévue demain à 14 h. Le technicien vous texte 30 minutes avant d'arriver et passera par la trappe du placard du couloir.",
       "Asking when the inspector arrives"),
    "c-s03": ("Laundry", "Black marks on the dryer vent hose and a musty smell in the laundry room", "pre_assessed", None, [
        ("in", 400, "Hi, I sent photos of my dryer vent this morning through the app."),
        ("out", 398, "Thanks Priya, we have them. The pre-assessment recommends an air quality test because of the smell."),
        ("in", 25, "Is it safe to keep using the dryer until then? My son has asthma."),
    ], "We can't give medical advice, so please check with his doctor about the asthma. For the dryer, keep the laundry room door open and "
       "run it only when someone can air the room. We can do the air test this week: moldbusters.ca/b", "Safety question about her case"),
    "c-s04": ("Other", "Tenants in two units report window condensation and black spots", "quoted", None, [
        ("in", 5000, "Bonjour, deux locataires se plaignent de condensation et de taches noires aux fenêtres."),
        ("out", 4990, "Bonjour Jean-Luc, l'inspection a trouvé que les ventilateurs de salle de bain se vident dans l'entretoit."),
        ("in", 90, "Pouvez-vous m'envoyer le rapport pour que je le partage avec les locataires?"),
    ], "Bien sûr. Je vous renvoie le rapport par courriel aujourd'hui; vous pouvez le transmettre aux locataires.",
       "Landlord asking for the report for his tenants"),
    "c-s05": ("Bedroom", "Condensation and dark spots on the bedroom window sill", "pre_assessed", None, [
        ("in", 700, "Hi, there's black stuff on my bedroom window sill every morning."),
        ("out", 698, "Thanks Emily. That's often condensation; the pre-assessment suggests a short video call to check the window and humidity."),
        ("in", 15, "Can I just clean it with bleach myself?"),
    ], "For a small area (under about 1 m²), Health Canada suggests water and unscented detergent with gloves and a mask; skip bleach. "
       "If it keeps coming back, it's worth finding the moisture source: a 20-minute video call can do it.", "DIY cleaning question"),
    "c-s06": ("Basement", "Positive swab under the basement sink", "report_approved", None, [
        ("in", 3000, "J'ai reçu le rapport, merci."),
        ("out", 2995, "Avec plaisir Robert. Des questions?"),
        ("in", 45, "Le test sur écouvillon est positif. Ça veut dire quoi exactement?"),
    ], "Le test sur écouvillon confirme la présence de contaminants biologiques sur la surface testée, sans identifier l'espèce. "
       "Ce qui compte, c'est de régler l'humidité sous l'évier et de nettoyer la zone. Voulez-vous que l'inspecteur vous appelle?",
       "Question about his report's swab result"),
    "c-s07": ("Bedroom", "Black spots on the bedroom wall, landlord not answering", "pre_assessed", None, [
        ("in", 800, "Hi, I rent my apartment and there are black spots on the bedroom wall."),
        ("out", 795, "Thanks Aisha. Your pre-assessment is ready; as a tenant, the landlord is responsible for repairs."),
        ("in", 20, "I've emailed my landlord twice, no answer. What can I do?"),
    ], "I'm sorry you're dealing with this. Our tenant action pack ($50) writes to your landlord for you from a Mold Busters address, "
       "follows up, then helps with a city property standards complaint if needed. You're copied on everything: moldbusters.ca/b",
       "Tenant asking what to do about an unresponsive landlord"),
}


def seed(save_case) -> int:
    now = clock.now()
    n = 0
    for cid, (room, concern, stage, visit, thread, draft, reason) in THREADS.items():
        c = db.get(Contact, cid)
        if not c:
            continue
        p = c.properties[0]
        case = Case(id=f"conv-{cid}", title=f"{c.name} · {room}", stage=stage, language=c.language, contact_id=cid, concern=concern,
                    customer=Customer(type=c.customer_type, alias=c.name), answers={"room": room, "concern": concern},
                    property=Property(province=p.province, postal_prefix=p.fsa, region_text=f"{p.address}, {p.city}"), seeded_from="synthetic demo data")
        if visit:
            day = clock.today() + timedelta(days=visit[0])
            case.booking = Booking(service="onsite", slot_text=f"{day:%A, %b} {day.day} · {visit[1]} ET", status="confirmed_simulated", slot_date=day,
                                   slot_time=visit[1], timezone="America/Toronto", customer_type=c.customer_type,
                                   contact=BookingContact(name=c.name, phone=c.phones[0], email=c.emails[0] if c.emails else "",
                                                          address=p.address, city=p.city, postal_code=p.postal))
        save_case(case)
        if case.id not in c.case_ids:
            c.case_ids.append(case.id)
        last_in = None
        for k, (who, mins, text) in enumerate(thread):
            at = now - timedelta(minutes=mins)
            m = Message(id=f"msg-{cid}-{k}", contact_id=cid, case_id=case.id, channel="sms", direction=who, body=text, final_body=text,
                        language=c.language, trigger="inbound" if who == "in" else "inbound_reply", is_cem=False,
                        status="received" if who == "in" else "sent_simulated", drafted_by="staff" if who == "in" else "ai",
                        approved_by=None if who == "in" else "ai", created_at=at, sent_at=None if who == "in" else at)
            db.put(m, Interaction(id=f"i-{cid}-t{k}", contact_id=cid, case_id=case.id, at=at, system="sms", kind=f"sms_{who}",
                                  summary=("Customer: " if who == "in" else "Mold Busters: ") + text[:160], synthetic=True))
            last_in = m if who == "in" else last_in
        reply = Message(id=f"msg-{cid}-draft", contact_id=cid, case_id=case.id, channel="sms", body=draft, language=c.language,
                        trigger="inbound_reply", is_cem="moldbusters.ca/b" in draft, reason=f"Reply to: \"{last_in.body[:70]}\" · {reason}",
                        status="draft", autonomy="draft", drafted_by="ai", in_reply_to=last_in.id if last_in else None,
                        created_at=now - timedelta(minutes=1))
        c.owner = "ai"
        db.put(reply, c)
        n += 1
    return n
