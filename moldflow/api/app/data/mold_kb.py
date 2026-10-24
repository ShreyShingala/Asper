"""Curated reference on moulds that lab reports commonly name. Plain-language, conservative, cited. Used ONLY to explain a
lab result that already names a mould: never to guess a species from a photo. Reviewed text; the AI may only rephrase it.

Key framing from Health Canada: "In most cases, there is no need to measure the actual concentration of mould in your
indoor air, or to determine the specific species of mould. You just need to find and fix the moisture and mould problems."
Why lab results only, never photos: docs/04_decisions.md D1."""
HC_MOULD = ("Health Canada: Mould", "https://www.canada.ca/en/health-canada/services/air-quality/indoor-air-contaminants/reduce-humidity-moisture-mould.html")
HC_PRO = ("Health Canada: Guidance for indoor air quality professionals",
          "https://www.canada.ca/en/health-canada/services/publications/healthy-living/guidance-indoor-air-quality-professionals.html")
EPA = ("US EPA: A Brief Guide to Mold, Moisture and Your Home", "https://www.epa.gov/mold/brief-guide-mold-moisture-and-your-home")
WHO = ("WHO guidelines for indoor air quality: dampness and mould", "https://www.who.int/publications/i/item/9789289041683")

COMMON = {
    "health": "Health Canada lists eye, nose and throat irritation, coughing, wheezing and worsening asthma as more likely in damp, mouldy homes, "
              "and advises anyone worried about their health to talk to a health care professional. We don't give medical advice.",
    "what_to_do": "Whatever the species, the fix is the same: find and stop the moisture source, then remove the mould safely. Small areas can "
                  "be cleaned with soap and water; large areas or mould that keeps coming back need a professional.",
}

TOPICS: dict[str, dict] = {
    "aspergillus": {"name": "Aspergillus", "summary": "One of the most common moulds indoors and outdoors.",
                    "where": "Dust, drywall paper, insulation, stored items; often where there is dampness or condensation.",
                    "moisture": "Grows with moderate dampness; finding it indoors in high amounts points to a moisture problem nearby.",
                    "sources": [HC_MOULD, EPA]},
    "penicillium": {"name": "Penicillium", "summary": "Very common indoor mould, often blue-green.",
                    "where": "Wallpaper, carpet, drywall, insulation and contents in damp rooms.",
                    "moisture": "Linked with dampness and water damage; elevated indoor levels usually mean a damp area.",
                    "sources": [HC_MOULD, EPA]},
    "cladosporium": {"name": "Cladosporium", "summary": "The most common mould outdoors; often found inside too.",
                     "where": "Window frames, sills, painted surfaces and anywhere condensation forms.",
                     "moisture": "Usually tied to condensation; compare indoor and outdoor samples before drawing conclusions.",
                     "sources": [HC_PRO, EPA]},
    "stachybotrys": {"name": "Stachybotrys", "summary": "Often called 'black mould', though colour alone never identifies a mould.",
                     "where": "Paper-faced drywall, ceiling tiles, cardboard and other cellulose materials that stayed wet.",
                     "moisture": "Needs materials to stay wet for a long time, so it usually signals long-term water damage or a leak.",
                     "sources": [HC_MOULD, WHO]},
    "chaetomium": {"name": "Chaetomium", "summary": "A mould associated with water-damaged buildings.",
                   "where": "Drywall, wallpaper, wood and other cellulose materials after leaks or flooding.",
                   "moisture": "Like Stachybotrys, it points to materials that have been wet for a long time.",
                   "sources": [HC_PRO, WHO]},
    "alternaria": {"name": "Alternaria", "summary": "A common outdoor mould that also grows indoors where it's wet.",
                   "where": "Showers, window frames, under sinks, around leaks.",
                   "moisture": "Indoors it usually means a persistently damp spot.",
                   "sources": [HC_MOULD, EPA]},
    "aureobasidium": {"name": "Aureobasidium", "summary": "Common on painted and caulked surfaces.",
                      "where": "Bathroom caulking, window frames, painted wood.",
                      "moisture": "Linked to surfaces that get wet often, like showers and windows with condensation.",
                      "sources": [HC_PRO, EPA]},
    "trichoderma": {"name": "Trichoderma", "summary": "Fast-growing mould found on damp wood and paper.",
                    "where": "Damp wood, wallpaper, drywall and carpet.",
                    "moisture": "Indicates ongoing moisture in building materials.",
                    "sources": [HC_PRO, WHO]},
    "ermi": {"name": "ERMI score", "summary": "The Environmental Relative Moldiness Index, a DNA test of settled dust developed by the US EPA as a research tool.",
             "where": "Compares 26 water-damage-associated species against 10 common species in a dust sample.",
             "moisture": "Higher scores mean relatively more of the water-damage-associated species than in reference homes. It isn't a standard for "
                         "deciding whether a home needs remediation: an inspection that finds the moisture source matters more.",
             "sources": [EPA, HC_PRO]},
}


def find(text: str) -> list[str]:
    t = text.lower()
    return [k for k, v in TOPICS.items() if k in t or v["name"].lower() in t]
