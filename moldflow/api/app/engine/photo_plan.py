"""Personalized photo plan for the live camera call.

The customer answers 5 tap questions before the call (where the spots are, size, smell/leak, postal code). From the spots
(room x surface, up to 3) and the size, this module picks the exact photos an inspector needs, within the photo limit.

Why these shots (from the Mold Busters sample pack):
- Every report must say what was seen, where the moisture comes from and how big it is, so each spot gets context (wide),
  detail (close-up) and, when there is room, size (scale) and the likely source (above / below / nearby plumbing, vents).
- In the virtual assessment the client showed only the reported spots (washer drum, dryer vent, ceiling and wall vents,
  oven) and the inspector kept one snapshot per spot. So: targeted spots, no full-house tour; a short sweep only when the
  area is big or there are several spots.
- Inspectors' on-site checks (tub/shower sealant and grout, standing water, faucet leaks, fans, under sinks, attic
  insulation and roof boards, exterior drainage) become the source shots per room."""
import json
from dataclasses import asdict, dataclass

from app import config

ROOMS = ["Bathroom", "Basement", "Kitchen", "Laundry", "Bedroom", "Attic", "Other"]
SURFACES = {
    "wall": "On a wall", "ceiling": "On the ceiling", "floor": "On the floor or baseboard", "vent": "In or around a vent",
    "window": "Around a window", "plumbing": "Around pipes, a sink or a tub", "appliance": "Inside or around an appliance",
}
SIZES = {"small": "Smaller than a hand", "door": "Up to the size of a door", "large": "Bigger than a door",
         "several": "Several spots in the room"}
SMELL_LEAK = {"smell": "A musty smell", "leak": "A leak or water damage", "both": "Both", "neither": "Neither", "unsure": "Not sure"}
SMELL_LEAK_ANSWERS = {  # -> (odor, leak) in the intake's canonical answers
    "smell": ("Yes", "No"), "leak": ("No", "Yes"), "both": ("Yes", "Yes"), "neither": ("No", "No"), "unsure": ("Not sure", "Not sure"),
}
MAX_SPOTS = 3

SURFACE_PHRASE = {"wall": "wall", "ceiling": "ceiling", "floor": "floor and baseboard", "vent": "vent", "window": "window",
                  "plumbing": "pipes and fixtures", "appliance": "appliance"}


@dataclass
class Shot:
    id: str
    spot: int
    room: str
    surface: str
    kind: str          # sweep | wide | close | scale | source
    title: str         # short label for the shot list
    instruction: str   # what the customer should show (also read out by Bruce)
    target: str        # what the focus box should look for
    frame: str = "center"  # where the target usually sits in the frame: center | top | bottom | full


# (id, title, instruction, target, frame)
SourceRule = tuple[str, str, str, str, str]

SURFACE_SOURCES: dict[str, list[SourceRule]] = {
    "ceiling": [("ceiling_around", "Ceiling around it", "Tilt up and show the ceiling around the stain, with any fan, light or vent nearby.",
                 "the stained ceiling area and nearby fixtures", "top")],
    "floor": [("baseboard", "Baseboard and floor edge", "Show where the floor meets the wall, along the baseboard next to it.",
               "the joint between floor and wall", "bottom")],
    "vent": [("vent_grille", "Vent grille close-up", "Come close to the vent grille so the slats fill the box.", "the vent grille slats", "center"),
             ("vent_inside", "Inside the vent", "Turn on your phone flashlight and point it into the vent opening.", "inside the duct opening", "center")],
    "window": [("window_sill", "Window sill and corners", "Show the window sill and the lower corners of the frame.", "the sill and frame corners", "bottom")],
    "plumbing": [("pipes", "Pipes and connections", "Show the pipes, joints and the surface right under them.", "pipe joints and wet marks", "bottom")],
    "appliance": [("appliance_seal", "Door seal or gasket", "Open it and show the rubber seal or gasket all the way around.", "the rubber seal or gasket", "center"),
                  ("appliance_behind", "Behind or under it", "Show the floor and wall behind or under the appliance, if you can reach.",
                   "the floor and wall behind the appliance", "bottom")],
    "wall": [("wall_base", "Bottom of the wall", "Show the bottom of the wall where it meets the floor, under the spot.",
              "the base of the wall", "bottom")],
}

ROOM_SOURCES: dict[str, list[SourceRule]] = {
    "Bathroom": [("tub_edge", "Tub or shower edge", "Show the caulking and grout where the tub or shower meets the wall.", "caulk and grout lines", "bottom"),
                 ("bath_fan", "Exhaust fan", "Point up at the bathroom fan grille. Turn the fan on if you can.", "the exhaust fan grille", "top"),
                 ("under_sink", "Under the sink", "Open the vanity and show the pipes and the cabinet floor.", "pipes and cabinet floor", "bottom")],
    "Basement": [("floor_joint", "Floor-to-wall joint", "Show where the floor meets the foundation wall, along the bottom.", "the floor-wall joint", "bottom"),
                 ("foundation", "Foundation wall", "Show the bare foundation wall, especially white powdery or damp marks.", "white or damp marks on the wall", "center"),
                 ("utilities", "Water heater or drain", "Show the water heater, furnace or floor drain nearest the spot.", "the base of the water heater or the drain", "bottom")],
    "Laundry": [("washer_seal", "Washer door seal", "Open the washer and show the rubber door seal and the drum.", "the washer door seal", "center"),
                ("dryer_vent", "Dryer vent hose", "Show the dryer vent hose and where it connects to the wall.", "the dryer vent hose and connection", "center"),
                ("behind_machines", "Behind the machines", "Show the floor and wall behind the washer and dryer.", "the floor behind the machines", "bottom")],
    "Kitchen": [("kitchen_sink", "Under the sink", "Open the cabinet under the sink and show the pipes and cabinet floor.", "pipes and cabinet floor", "bottom"),
                ("range_area", "Range hood or oven area", "Show the range hood and the wall or cabinet around the oven.", "the range hood and wall around it", "top")],
    "Attic": [("roof_boards", "Underside of the roof", "Point up at the underside of the roof boards near the spot.", "the roof boards", "top"),
              ("insulation", "Insulation", "Show the insulation on the floor of the attic around the spot.", "the insulation surface", "bottom"),
              ("attic_vents", "Roof or soffit vents", "Show the nearest roof vent or soffit vent along the edge.", "the vent openings", "center")],
    "Bedroom": [("outer_corners", "Outside-wall corners", "Show the corners where outside walls meet the ceiling and floor.", "the wall corners", "top"),
                ("closet_wall", "Back of the closet", "Open the closet and show its back wall.", "the closet back wall", "center")],
    "Other": [("outer_corners", "Outside-wall corners", "Show the nearest corner where an outside wall meets the ceiling or floor.", "the wall corners", "top")],
}


def _spot_label(room: str, surface: str) -> str:
    return f"{room} · {SURFACE_PHRASE.get(surface, surface)}"


def _base_shots(i: int, room: str, surface: str) -> dict[str, Shot]:
    where = f"the {SURFACE_PHRASE.get(surface, surface)}"
    pre = f"s{i + 1}_"
    return {
        "wide": Shot(pre + "wide", i, room, surface, "wide", f"Wide view · {_spot_label(room, surface)}",
                     f"Step back so {where} and what's around it are all in view.", f"the whole affected area on {where}", "full"),
        "close": Shot(pre + "close", i, room, surface, "close", f"Close-up · {_spot_label(room, surface)}",
                      "Come closer, about an arm's length, so the spot fills the box.", "the discoloured or damaged patch", "center"),
        "scale": Shot(pre + "scale", i, room, surface, "scale", "Size check", "Hold your hand or a sheet of paper next to the spot.",
                      "the spot with a hand or paper beside it", "center"),
    }


def _sources(i: int, room: str, surface: str) -> list[Shot]:
    seen, out = set(), []
    for sid, title, instr, target, frame in SURFACE_SOURCES.get(surface, []) + ROOM_SOURCES.get(room, ROOM_SOURCES["Other"]):
        if sid in seen:
            continue
        seen.add(sid)
        out.append(Shot(f"s{i + 1}_{sid}", i, room, surface, "source", title, instr, target, frame))
    return out


def build_plan(spots: list[dict], size: str | None, max_photos: int | None = None) -> list[Shot]:
    """Ordered shot list. Priority: sweep (big area / several spots) > wide per spot > close-up per spot > size check (one spot)
    > source shots, alternating between spots, until the photo limit."""
    max_photos = max_photos or config.LIVE_MAX_PHOTOS
    spots = [s for s in spots if s.get("room") in ROOMS and s.get("surface") in SURFACES][:MAX_SPOTS] or [{"room": "Other", "surface": "wall"}]
    plan: list[Shot] = []
    if size in ("large", "several"):
        r, sf = spots[0]["room"], spots[0]["surface"]
        plan.append(Shot("sweep", 0, r, sf, "sweep", "Slow scan around the area",
                         "Start at the left edge of the problem area and follow the arrow slowly to the right.", "the whole affected zone", "full"))
    bases = [_base_shots(i, s["room"], s["surface"]) for i, s in enumerate(spots)]
    plan += [b["wide"] for b in bases] + [b["close"] for b in bases]
    if len(spots) == 1 and size in ("small", "door", None):
        plan.append(bases[0]["scale"])
    sources = [_sources(i, s["room"], s["surface"]) for i, s in enumerate(spots)]
    k = 0
    while len(plan) < max_photos and any(k < len(src) for src in sources):
        for src in sources:
            if k < len(src) and len(plan) < max_photos:
                plan.append(src[k])
        k += 1
    return plan[:max_photos]


def spots_from_answers(answers: dict[str, str]) -> list[dict]:
    try:
        return json.loads(answers.get("spots") or "[]")
    except json.JSONDecodeError:
        return []


def plan_for_case(answers: dict[str, str]) -> list[Shot] | None:
    """None when the case didn't go through the pre-call questions (old live calls keep the legacy checklist)."""
    spots = spots_from_answers(answers)
    return build_plan(spots, answers.get("size")) if spots else None


def plan_dicts(plan: list[Shot]) -> list[dict]:
    return [asdict(s) for s in plan]


def precall_options() -> dict:
    return {"rooms": ROOMS, "surfaces": SURFACES, "sizes": SIZES, "smell_leak": SMELL_LEAK, "max_spots": MAX_SPOTS,
            "max_photos": config.LIVE_MAX_PHOTOS}
