"""Deterministic AI stand-ins for end-to-end browser tests (MOLDFLOW_E2E_STUB=1). Never enabled in normal runs."""
STUBS: dict[str, dict] = {
    "PhotoAnalysis": {"image_type": "regular", "observations": ["White vent slats with dark gaps.", "Light wall around the vent."],
                      "regions": [{"label": "look closer: vent slats", "box_2d": [300, 200, 700, 800]}], "visible_moisture": None,
                      "scale_reference_visible": False, "quality": "ok", "follow_up_question": "Is there a musty smell near the vent?",
                      "declined_to_confirm_mold": True},
    "AssessDraft": {"summary": "You showed a vent with dark spots in your laundry room. An inspector can check what photos can't.",
                    "observed": ["Dark spots between vent slats."], "cannot_tell": ["Whether the spots are fungal without sampling."],
                    "suggested_service": "virtual", "reasons": ["Small visible area"], "unknowns": [], "escalate": False},
    "LiveSummary": {"concern": "Dark spots on the laundry room vent.", "summary": "Customer showed a laundry vent with dark spots.",
                    "key_points": ["Dark spots on the vent"]},
}
