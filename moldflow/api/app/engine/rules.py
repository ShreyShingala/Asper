"""Deterministic business rules: service area, routing overrides, health branch, letters, follow-up triggers."""
from datetime import date

from app.engine.pricing import service_price_text
from app.models.agents import AssessDraft, ChipQuestion, IntakeTurn, PhotoPrompt, Routing
from app.models.passport import Case

HEALTH_TEXT = {
    "en": "We can't give medical advice; please speak with a doctor about any symptoms. We can arrange a professional Indoor Air Quality test.",
    "fr": "Nous ne pouvons pas donner d'avis médical; veuillez consulter un médecin au sujet de vos symptômes. Nous pouvons organiser un test professionnel de qualité de l'air intérieur.",
}
ON_PREFIXES, QC_PREFIXES = set("KLMNP"), set("GHJ")

CHIPS = {
    "en": [
        ChipQuestion(key="room", text="Where is it?", options=["Bathroom", "Basement", "Kitchen", "Laundry", "Bedroom", "Attic", "Other"]),
        ChipQuestion(key="occupant", text="Are you the…", options=["Owner", "Tenant", "Landlord / manager"]),
        ChipQuestion(key="symptoms", text="Anyone in the home having health symptoms?", options=["Yes", "No", "Prefer not to say"]),
        ChipQuestion(key="odor", text="Is there a musty smell?", options=["Yes", "No", "Not sure"]),
        ChipQuestion(key="leak", text="Any known leak or water damage nearby?", options=["Yes", "No", "Not sure"]),
    ],
    "fr": [
        ChipQuestion(key="room", text="Où est-ce?", options=["Salle de bain", "Sous-sol", "Cuisine", "Buanderie", "Chambre", "Grenier", "Autre"]),
        ChipQuestion(key="occupant", text="Vous êtes…", options=["Propriétaire", "Locataire", "Propriétaire-bailleur / gestionnaire"]),
        ChipQuestion(key="symptoms", text="Quelqu'un dans le logement a-t-il des symptômes?", options=["Oui", "Non", "Je préfère ne pas répondre"]),
        ChipQuestion(key="odor", text="Y a-t-il une odeur de moisi?", options=["Oui", "Non", "Je ne sais pas"]),
        ChipQuestion(key="leak", text="Fuite ou dégât d'eau connu à proximité?", options=["Oui", "Non", "Je ne sais pas"]),
    ],
}
# canonical answer values regardless of language
CANON = {"Salle de bain": "Bathroom", "Sous-sol": "Basement", "Cuisine": "Kitchen", "Buanderie": "Laundry", "Chambre": "Bedroom",
         "Grenier": "Attic", "Autre": "Other", "Propriétaire": "Owner", "Locataire": "Tenant",
         "Propriétaire-bailleur / gestionnaire": "Landlord / manager", "Oui": "Yes", "Non": "No",
         "Je préfère ne pas répondre": "Prefer not to say", "Je ne sais pas": "Not sure"}

PHOTO_PROMPTS = {
    "en": [
        PhotoPrompt(prompt_id="wide", text="Take one wide photo showing the whole area and the room around it.", why="Context: where it is and how big."),
        PhotoPrompt(prompt_id="close", text="Now a close-up, about an arm's length away.", why="Detail of the surface."),
        PhotoPrompt(prompt_id="above", text="What's directly above it? Show the ceiling (or the floor above, if you can).", why="Leaks often come from above."),
        PhotoPrompt(prompt_id="nearby", text="Any plumbing, vent, window or appliance nearby? Show it.", why="Common moisture sources."),
        PhotoPrompt(prompt_id="scale", text="Optional: hold a sheet of paper next to it for scale.", why="Helps judge size."),
    ],
    "fr": [
        PhotoPrompt(prompt_id="wide", text="Prenez une photo large montrant toute la zone et la pièce autour.", why="Contexte : où et quelle taille."),
        PhotoPrompt(prompt_id="close", text="Maintenant un gros plan, à environ une longueur de bras.", why="Détail de la surface."),
        PhotoPrompt(prompt_id="above", text="Qu'y a-t-il juste au-dessus? Montrez le plafond.", why="Les fuites viennent souvent d'en haut."),
        PhotoPrompt(prompt_id="nearby", text="Plomberie, ventilation, fenêtre ou appareil à proximité? Montrez-les.", why="Sources d'humidité courantes."),
        PhotoPrompt(prompt_id="scale", text="Optionnel : tenez une feuille de papier à côté pour l'échelle.", why="Aide à juger la taille."),
    ],
}
MAX_PHOTOS = 4


def canon(v: str) -> str:
    return CANON.get(v, v)


def apply_location(case: Case, value: str) -> None:
    """value = Canadian postal code / prefix, or a country name."""
    v = value.strip().upper()
    p = case.property
    if v and v[0].isalpha() and len(v) <= 7 and any(c.isdigit() for c in v):
        p.country, p.postal_prefix = "CA", v[:3]
        p.province = "ON" if v[0] in ON_PREFIXES else "QC" if v[0] in QC_PREFIXES else "other"
    else:
        p.country, p.postal_prefix = (value.strip() or "unknown"), None
        p.province = "other"
    p.in_service_area = p.country == "CA" and p.province in ("ON", "QC")


def next_turn(case: Case) -> IntakeTurn:
    """Deterministic, interleaved intake: photo first, then chips, adaptive photo prompts, location."""
    lang = case.language
    taken = {ph.prompt_id for ph in case.photos if ph.source == "customer"}
    n_photos = sum(1 for ph in case.photos if ph.source == "customer")
    prompts = {p.prompt_id: p for p in PHOTO_PROMPTS[lang]}
    if n_photos == 0:
        return IntakeTurn(photo_prompt=prompts["wide"])
    for chip in CHIPS[lang][:3]:
        if chip.key not in case.answers:
            return IntakeTurn(next_chip_question=chip)
    if "close" not in taken and n_photos < MAX_PHOTOS:
        return IntakeTurn(photo_prompt=prompts["close"])
    for chip in CHIPS[lang][3:]:
        if chip.key not in case.answers:
            return IntakeTurn(next_chip_question=chip)
    if case.answers.get("leak") != "No" or case.answers.get("room") in ("Bathroom", "Basement", "Laundry", "Kitchen"):
        for pid in ("above", "nearby"):
            if pid not in taken and n_photos < MAX_PHOTOS and f"skip:{pid}" not in case.answers:
                return IntakeTurn(photo_prompt=prompts[pid])
    if "location" not in case.answers:
        return IntakeTurn(next_chip_question=ChipQuestion(
            key="location", text="Postal code (or country, if outside Canada)" if lang == "en" else "Code postal (ou pays, hors Canada)", options=[]))
    return IntakeTurn(ready=True)


def route(case: Case, draft: AssessDraft) -> Routing:
    reasons = list(draft.reasons)
    a = case.answers
    if case.property.in_service_area is False:
        return Routing(service="remote_report", reasons=["Property is outside Mold Busters' on-site service area"] + reasons[:1],
                       unknowns=draft.unknowns)
    if case.health_flag and a.get("odor") in ("Yes", "Not sure"):
        return Routing(service="iaq", reasons=["Health symptoms + odour reported: an air test checks what photos cannot"] + reasons[:2],
                       unknowns=draft.unknowns, escalate=draft.escalate)
    service = draft.suggested_service
    if a.get("leak") == "Yes" and service == "virtual":
        service, reasons = "onsite", ["Known leak: moisture behind surfaces needs instruments on site"] + reasons[:2]
    if a.get("room") == "Attic" and service == "virtual":
        service, reasons = "onsite", ["Attics need an inspector's access and instruments"] + reasons[:2]
    return Routing(service=service, reasons=reasons[:3], unknowns=draft.unknowns, escalate=draft.escalate)


def next_actions(case: Case, service: str) -> list[str]:
    acts = ["remote_report"] if service == "remote_report" else ["book"]
    if case.customer.type == "tenant":
        acts.append("landlord_letter")
    acts.append("call_me")
    return acts


def price_text(case: Case, service: str) -> str:
    return service_price_text(service, case.property.province, case.language)


def landlord_letter(case: Case, lang: str) -> tuple[str, list[str]]:
    obs, ids = [], []
    for ph in case.photos:
        if ph.analysis and ph.analysis.observations:
            obs.append(ph.analysis.observations[0])
            ids.append(ph.id)
    if case.pre_assessment:
        obs = obs or case.pre_assessment.observed
    obs = obs[:4]
    today = date.today().isoformat()
    room = case.answers.get("room", "the unit")
    if lang == "fr":
        lines = [f"Date : {today}", "", "Madame, Monsieur,", "",
                 f"Je vous écris au sujet de ce qui semble être une décoloration / possible moisissure ({room.lower()}) dans mon logement.",
                 "Observations enregistrées (photos disponibles) :"] + [f"  • {o}" for o in obs] + [
                 "", "Ces observations ne confirment pas la présence de moisissure; seul un échantillonnage professionnel le peut.",
                 "Je vous demande de faire inspecter la situation par un professionnel qualifié (par ex. un test de qualité de l'air intérieur).",
                 "", "Cordialement,", "[Votre nom]", "",
                 "Préparé pour l'usage personnel du locataire à partir d'observations enregistrées. Ceci n'est pas un avis juridique."]
    else:
        lines = [f"Date: {today}", "", "Dear Landlord / Property Manager,", "",
                 f"I am writing about what appears to be discoloration / possible mold ({room.lower()}) in my unit.",
                 "Recorded observations (photos available):"] + [f"  • {o}" for o in obs] + [
                 "", "These observations do not confirm mold; only professional sampling can.",
                 "I am requesting that the issue be assessed by a qualified professional (for example, an Indoor Air Quality test).",
                 "", "Sincerely,", "[Your name]", "",
                 "Prepared for the tenant's own use, based on recorded observations. Not legal advice."]
    return "\n".join(lines), ids
