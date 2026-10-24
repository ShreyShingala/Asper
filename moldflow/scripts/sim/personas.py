"""Simulated customers for Bruce. Facts come from the sample-pack job stories/timelines (customer side only), never from
the reference reports. `facts` = what the customer will say if asked; `expect` = what a good call must produce."""
from dataclasses import dataclass, field

J1 = "01_OnSite_Sample/Photos/"
J2 = "02_Virtual_Sample/Photos/"
JOB2_SHOTS = {"wide": [J2 + "01_Discoloration_dryer_vent_hose.jpg"], "close": [J2 + "03_Discoloration_vent_grille.jpg"],
              "above": [J2 + "02_Discoloration_ceiling_vent.jpg"], "nearby": [J2 + "01_Discoloration_dryer_vent_hose.jpg"],
              "scale": [J2 + "03_Discoloration_vent_grille.jpg"], "extra": [J2 + "02_Discoloration_ceiling_vent.jpg"]}
JOB1_SHOTS = {"wide": [J1 + "13_Washroom_discoloration_1.jpg"], "close": [J1 + "14_Washroom_discoloration_2.jpg", J1 + "15_Washroom_discoloration_3.jpg"],
              "above": [J1 + "08_Thermal_anomaly_1.jpg", J1 + "10_Thermal_anomaly_3.jpg"],
              "nearby": [J1 + "16_Elevated_moisture_at_tub_faucet.jpg", J1 + "12_Ball_slope_test_failed_shower.jpg"],
              "scale": [J1 + "15_Washroom_discoloration_3.jpg"], "extra": [J1 + "12_Ball_slope_test_failed_shower.jpg"]}


@dataclass
class Persona:
    name: str
    opening: str                      # first description of the problem (the concern)
    facts: dict[str, str]             # checklist key -> canonical expected answer
    say: dict[str, list[str]]         # checklist key -> how the customer phrases it (cycled)
    shots: dict[str, list[str]]
    expect_service: set[str]
    concern_words: list[str]          # at least one must appear in the saved concern
    off_script: list[tuple[int, str]] = field(default_factory=list)   # (customer turn index, line)
    vague_first: bool = False         # answers each question vaguely the first time
    quit_after_photos: int | None = None
    dark_first: bool = False
    extra_checks: list[str] = field(default_factory=list)


JOB2_SAY = {
    "room": ["It's in the laundry room, around the washer and dryer."],
    "occupant": ["I own the place."],
    "symptoms": ["No, nobody's sick."],
    "odor": ["Yes, there's a strong musty smell that doesn't go away even after cleaning."],
    "leak": ["Not that I know of."],
    "location": ["My postal code is H2X 1Y4."],
}

PERSONAS: dict[str, Persona] = {p.name: p for p in [
    Persona("job2-virtual",
            "I keep finding black and white spots inside my washing machine and around the dryer vent, and there's a smell that won't go away.",
            {"room": "Laundry", "occupant": "Owner", "symptoms": "No", "odor": "Yes", "leak": "No", "location": "H2X 1Y4"},
            JOB2_SAY, JOB2_SHOTS, {"virtual", "onsite", "iaq"}, ["washing", "washer", "dryer", "vent", "spot", "smell"]),
    Persona("job1-washroom",
            "There's staining on the ceiling and grout in our upstairs washroom, and the tub faucet has been leaking.",
            {"room": "Bathroom", "occupant": "Owner", "symptoms": "No", "odor": "No", "leak": "Yes", "location": "K1A 0B1"},
            {"room": ["The upstairs washroom, by the shower."], "occupant": ["We own the house."], "symptoms": ["No, we're all fine."],
             "odor": ["No, I don't really smell anything."], "leak": ["Yes, the tub faucet drips and the shower pools water."],
             "location": ["It's K1A 0B1."]},
            JOB1_SHOTS, {"onsite"}, ["ceiling", "grout", "washroom", "faucet", "stain", "leak"],
            extra_checks=["mentions_moisture"]),
    Persona("tenant",
            "I rent an apartment and there's black and white stuff around the washer, the dryer and the vents.",
            {"room": "Laundry", "occupant": "Tenant", "symptoms": "No", "odor": "Yes", "leak": "No", "location": "H2X 1Y4"},
            {**JOB2_SAY, "occupant": ["I'm a tenant, I rent this apartment."]}, JOB2_SHOTS, {"virtual", "onsite", "iaq"},
            ["washer", "dryer", "vent", "black", "white"], extra_checks=["tenant_letter", "tenant_phone"]),
    Persona("outside-canada",
            "There are dark spots on the vents in my laundry room and it smells musty.",
            {"room": "Laundry", "occupant": "Owner", "symptoms": "No", "odor": "Yes", "leak": "No", "location": "Australia"},
            {**JOB2_SAY, "location": ["I'm in Australia, actually, in Sydney."]}, JOB2_SHOTS, {"remote_report"}, ["vent", "spot", "smell", "musty"]),
    Persona("health",
            "There's staining in our upstairs washroom and my kid has had a cough for a few weeks.",
            {"room": "Bathroom", "occupant": "Owner", "symptoms": "Yes", "odor": "Yes", "leak": "Yes", "location": "K1A 0B1"},
            {"room": ["The upstairs washroom."], "occupant": ["We own it."], "symptoms": ["Yes, my kid has a cough."],
             "odor": ["Yes, it smells kind of musty in there."], "leak": ["Yes, the tub faucet leaks."], "location": ["K1A 0B1."]},
            JOB1_SHOTS, {"iaq"}, ["stain", "washroom", "cough"],
            off_script=[(3, "Is it dangerous for my kid to breathe this?")], extra_checks=["medical_disclaimer"]),
    Persona("messy",
            "Uh, so, there's like, stuff on the ceiling? In the bathroom I think. It's been a while.",
            {"room": "Bathroom", "occupant": "Owner", "symptoms": "No", "odor": "Not sure", "leak": "Not sure", "location": "K1A 0B1"},
            {"room": ["The bathroom, upstairs."], "occupant": ["We own it."], "symptoms": ["Nope."], "odor": ["Kinda? I don't know."],
             "leak": ["Maybe, I'm not sure."], "location": ["K1A 0B1."]},
            JOB1_SHOTS, {"onsite"}, ["ceiling", "bathroom", "stuff"],
            off_script=[(2, "Sorry, wait, how much is this going to cost me?"), (5, "Hang on, my dog is barking. Okay, go ahead.")],
            vague_first=True),
    Persona("dark-room",
            "There are dark spots on the vent grille in my laundry room.",
            {"room": "Laundry", "occupant": "Owner", "symptoms": "No", "odor": "Yes", "leak": "No", "location": "H2X 1Y4"},
            JOB2_SAY, JOB2_SHOTS, {"virtual", "onsite", "iaq"}, ["vent", "grille", "spot"], dark_first=True,
            extra_checks=["light_coaching"]),
    Persona("quitter",
            "There are dark spots on the vent in my laundry room.",
            {"room": "Laundry"},
            {"room": ["Laundry room."], "occupant": ["I own it."], "symptoms": ["No."], "odor": ["A little."], "leak": ["No."], "location": ["H2X 1Y4."]},
            JOB2_SHOTS, {"virtual", "onsite", "iaq"}, ["vent", "spot"], quit_after_photos=1),
]}
