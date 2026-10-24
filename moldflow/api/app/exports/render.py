"""PDF (reportlab) and CSV exports. The report PDF follows the structure of an MB report:
property & concern -> findings by room with evidence photos -> recommendations -> limitations -> estimate -> sign-off."""
import csv
import io
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app import config
from app.models.passport import Case, Photo

# Same orange theme as the web app (WCAG AA: #C2410C is 5.18:1 on white; muted text #646677 is 5.66:1).
ACCENT = colors.HexColor("#C2410C")
INK = colors.HexColor("#0F142A")
MUTED = colors.HexColor("#646677")
SS = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=SS["Heading1"], textColor=ACCENT, fontSize=18)
H2 = ParagraphStyle("h2", parent=SS["Heading2"], textColor=ACCENT, fontSize=13, spaceBefore=10)
BODY = ParagraphStyle("b", parent=SS["BodyText"], fontSize=9.5, leading=13, textColor=INK)
SMALL = ParagraphStyle("s", parent=BODY, fontSize=7.5, textColor=MUTED, leading=10)
DISCLAIMER = ("Prototype output. MoldFlow assists qualified inspectors; it does not identify, diagnose or confirm mold. "
              "Visual and thermal observations cannot confirm mold without physical sampling and laboratory analysis.")


def photo_file(p: Photo) -> Path:
    return (config.PACK_DIR / p.path) if not p.path.startswith("uploads/") else (config.DATA_DIR / p.path)


def annotated(p: Photo, max_side: int = 520) -> io.BytesIO:
    img = Image.open(photo_file(p)).convert("RGB")
    img.thumbnail((max_side, max_side))
    if p.analysis and p.analysis.regions:
        d = ImageDraw.Draw(img)
        w, h = img.size
        for r in p.analysis.regions:
            y0, x0, y1, x1 = r.box_2d
            d.rectangle([x0 * w / 1000, y0 * h / 1000, x1 * w / 1000, y1 * h / 1000], outline=(255, 176, 32), width=3)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=80)
    buf.seek(0)
    return buf


def _img(p: Photo, width: float) -> RLImage:
    buf = annotated(p)
    w, h = Image.open(buf).size
    buf.seek(0)
    return RLImage(buf, width=width, height=width * h / w)


def _photo_grid(photos: list[Photo], cols: int = 4) -> Table | None:
    if not photos:
        return None
    w = 1.6 * inch
    cells = [[_img(p, w), Paragraph(f"<b>{p.id}</b> {p.caption_from_pack or (p.analysis.observations[0] if p.analysis else '')}", SMALL)]
             for p in photos]
    rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
    data = []
    for r in rows:
        data.append([c[0] for c in r] + [""] * (cols - len(r)))
        data.append([c[1] for c in r] + [""] * (cols - len(r)))
    t = Table(data, colWidths=[w + 6] * cols)
    t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return t


def _page(canvas, doc) -> None:
    """Orange brand band at the top of every page and a muted footer with the page number."""
    w, h = letter
    canvas.saveState()
    canvas.setFillColor(ACCENT)
    canvas.rect(0, h - 0.22 * inch, w, 0.22 * inch, stroke=0, fill=1)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.6 * inch, 0.3 * inch, "Mold Busters · MoldFlow")
    canvas.drawRightString(w - 0.6 * inch, 0.3 * inch, f"Page {doc.page}")
    canvas.restoreState()


def _doc(story: list) -> bytes:
    buf = io.BytesIO()
    SimpleDocTemplate(buf, pagesize=letter, leftMargin=0.6 * inch, rightMargin=0.6 * inch, topMargin=0.6 * inch,
                      bottomMargin=0.6 * inch, title="MoldFlow").build(story, onFirstPage=_page, onLaterPages=_page)
    return buf.getvalue()


def _live_section(case: Case, transcript: bool) -> list:
    lv = case.live
    if not lv or not (lv.summary or lv.transcript):
        return []
    s = [Paragraph("Live call with the AI assistant", H2)]
    if lv.summary:
        s.append(Paragraph(escape(lv.summary), BODY))
    s += [Paragraph(f"• {escape(k)}", BODY) for k in lv.key_points]
    if transcript and lv.transcript:
        s += [Spacer(1, 4), Paragraph("Transcript", SMALL)]
        s += [Paragraph(f"<b>{'Customer' if t.role == 'customer' else 'AI'}:</b> {escape(t.text)}", SMALL) for t in lv.transcript]
    return s


def report_pdf(case: Case) -> bytes:
    rep = case.report.draft if case.report else None
    approval = next((a for a in reversed(case.approvals) if a.what == "report"), None)
    s = [Paragraph("Mold Busters · Inspection Report (MoldFlow draft)", H1),
         Paragraph(f"<b>Property:</b> {case.property.region_text or case.property.province} &nbsp; <b>Client:</b> {case.customer.alias}", BODY),
         Paragraph(f"<b>Client concern:</b> {case.concern}", BODY),
         Paragraph(f"<b>Status:</b> {'Approved by ' + approval.reviewed_by + ' on ' + approval.at.strftime('%Y-%m-%d %H:%M') if approval else 'DRAFT (not approved)'}"
                   " &nbsp; <b>Drafted by:</b> MoldFlow", BODY), Spacer(1, 6)]
    if rep:
        s += [Paragraph("Summary", H2), Paragraph(rep.summary, BODY)]
        for sec in rep.sections:
            s.append(Paragraph(sec.room, H2))
            for c in sec.claims:
                s.append(Paragraph(f"• {c.text} <font color='#646677' size='7'>[{', '.join(c.cites)}]</font>", BODY))
            ids = {x for c in sec.claims for x in c.cites}
            ids |= {pid for f in case.findings if f.id in ids for pid in f.evidence_photo_ids}
            if grid := _photo_grid([p for p in case.photos if p.id in ids][:8]):
                s += [Spacer(1, 4), grid]
        s += [Paragraph("Recommendations", H2)] + [Paragraph(f"• {c.text} <font color='#646677' size='7'>[{', '.join(c.cites)}]</font>", BODY)
                                                    for c in rep.recommendations]
        s += [Paragraph("Limitations", H2)] + [Paragraph(f"• {x}", BODY) for x in rep.limitations]
    s += _live_section(case, transcript=True)
    if e := case.estimate:
        s += [Paragraph(f"Estimate {e.id}", H2), Paragraph(f"Areas: {', '.join(e.areas)}", BODY)]
        s += [Paragraph(f"• {x}", BODY) for x in e.scope_text]
        s += [Paragraph(f"<b>Subtotal ${e.subtotal} + {e.tax_label} ${e.tax} = ${e.total}</b>"
                        + (f" · Deposit {e.deposit_pct}%: ${e.deposit}" if e.deposit else "")
                        + (f" · Valid until {e.expires_on}" if e.expires_on else ""), BODY)]
    s += [Spacer(1, 10), Paragraph(DISCLAIMER, SMALL)]
    return _doc(s)


def pre_assessment_pdf(case: Case) -> bytes:
    pa = case.pre_assessment
    s = [Paragraph("Your MoldFlow Pre-Assessment", H1), Paragraph("Mold Busters · AI-assisted, reviewed by staff before any appointment", SMALL),
         Spacer(1, 6)]
    if pa:
        s += [Paragraph(pa.summary, BODY), Paragraph("What we can see", H2)] + [Paragraph(f"• {x}", BODY) for x in pa.observed]
        s += [Paragraph("What photos can't tell us", H2)] + [Paragraph(f"• {x}", BODY) for x in pa.cannot_tell]
        s += [Paragraph("Recommended next step", H2), Paragraph(f"<b>{pa.service_price_text}</b>", BODY)]
        s += [Paragraph(f"• {r}", BODY) for r in pa.reasons]
        if pa.health_note:
            s += [Spacer(1, 4), Paragraph(pa.health_note, BODY)]
    s += _live_section(case, transcript=False)
    if grid := _photo_grid([p for p in case.photos if p.source == "customer"]):
        s += [Paragraph("Your photos (highlighted areas = suggestions for a closer look, not confirmed mold)", H2), grid]
    s += [Spacer(1, 10), Paragraph(DISCLAIMER + " Prices shown are Mold Busters' published service rates; remediation costs can only be "
                                                "estimated after an inspection.", SMALL)]
    return _doc(s)


def estimate_csv(case: Case) -> str:
    """FreshBooks-style line-item CSV."""
    e = case.estimate
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Estimate Number", "Client", "Item Name", "Item Description", "Rate", "Quantity", "Tax 1 Name", "Tax 1 Percent", "Line Total", "Illustrative"])
    items = e.line_items or []
    if not items:
        w.writerow([e.id, case.customer.alias, e.service, "; ".join(e.scope_text), e.subtotal, 1, e.tax_label, e.tax_rate * 100, e.subtotal, "no"])
    for li in items:
        w.writerow([e.id, case.customer.alias, li.code, li.description, li.unit_price, li.qty, e.tax_label, e.tax_rate * 100,
                    li.unit_price * li.qty, "yes" if li.illustrative else "no"])
    return buf.getvalue()


# ---------------------------------------------------------------- $20 AI pre-assessment report (Mold Busters report format)
HEALTH_CANADA = ("Health Canada considers indoor mould growth to be a significant health hazard and recommends that all mould, "
                 "regardless of the species, be cleaned and that the underlying water or humidity problem be dealt with quickly. "
                 "(Source: Addressing moisture and mould in your home; Canada.ca)")
LIMITS = ("This is a remote, non-invasive pre-assessment based on the photos and answers you provided at the time of submission. "
          "Areas that were not photographed or are hidden (behind walls, under floors, inside ducts) may contain concerns not "
          "presented here. Photos cannot confirm mould: only physical sampling and laboratory analysis can.")


def _big_img(p: Photo, width: float) -> RLImage:
    buf = annotated(p, max_side=900)
    w, h = Image.open(buf).size
    buf.seek(0)
    return RLImage(buf, width=width, height=min(width * h / w, 3.6 * inch))


def ai_report_pdf(case: Case) -> bytes:
    from app.engine import photo_plan
    pa = case.pre_assessment
    a = case.answers
    titles = {s.id: s for s in (photo_plan.plan_for_case(a) or [])}
    photos = [p for p in case.photos if p.source == "customer"]
    spots = photo_plan.spots_from_answers(a) or [{"room": a.get("room", "Other"), "surface": "wall"}]
    when = (pa.generated_at if pa else case.created_at).strftime("%B %d, %Y")
    s = [Paragraph("Mold Busters", SMALL), Paragraph("AI PRE-ASSESSMENT REPORT", H1),
         Paragraph(f"<b>Prepared for:</b> {escape(case.customer.alias)} &nbsp; <b>Property:</b> {escape(case.property.region_text or case.property.postal_prefix or case.property.province)}"
                   f" &nbsp; <b>Date:</b> {when}", BODY),
         Paragraph("<b>Assessment type:</b> Remote AI pre-assessment (customer photos, guided call and answers)", BODY), Spacer(1, 6),
         Paragraph("01 · Objectives", H2)]
    s += [Paragraph(f"{i}. {t}", BODY) for i, t in enumerate([
        "Review the photographed areas of the property to identify any visible indoor environmental concerns;",
        "Point to the likely source(s) of moisture and the apparent extent of the concern, where photos allow;",
        "Recommend the most appropriate next step."], 1)]
    s += [Paragraph("02 · Diagnostic results", H2),
          Paragraph("<b>Location(s):</b> " + escape("; ".join(f"{x['room']} ({photo_plan.SURFACES.get(x['surface'], x['surface']).lower()})" for x in spots)), BODY),
          Paragraph("<b>General observations:</b>", BODY)]
    obs = []
    if case.concern:
        obs.append(f"The client reported: \"{case.concern}\".")
    if a.get("odor") == "Yes":
        obs.append("The client noted musty odours. Musty odours are often associated with moisture problems or hidden growth.")
    if a.get("leak") == "Yes":
        obs.append("The client reported a leak or water damage nearby, a likely moisture source to confirm on site.")
    if a.get("symptoms") == "Yes" or case.health_flag:
        obs.append("Health-related issues were reported by the client while living in the property.")
    if size := photo_plan.SIZES.get(a.get("size", "")):
        obs.append(f"Approximate size reported: {size.lower()}.")
    for p in photos:
        if p.analysis:
            obs += [f"{(titles[p.prompt_id].title if p.prompt_id in titles else 'Photo')}: {o}" for o in p.analysis.observations[:2]]
    if case.live and case.live.key_points:
        obs += [f"From the guided call: {k}" for k in case.live.key_points[:3]]
    s += [Paragraph(f"• {escape(o)}", BODY) for o in obs] or [Paragraph("• Photos received for review.", BODY)]

    s += [Paragraph("03 · Photographic evidence", H2),
          Paragraph("Photographs taken by the client during the guided assessment. Highlighted boxes are areas the analysis suggests "
                    "looking at more closely; they are not confirmed mould.", SMALL), Spacer(1, 4)]
    for n, p in enumerate(photos, 1):
        title = titles[p.prompt_id].title if p.prompt_id in titles else (p.caption_from_pack or "Photo")
        an = p.analysis
        right = [Paragraph(f"<b>#{n} · {escape(title)}</b>", BODY)]
        if an:
            right += [Paragraph("<b>What the analysis sees</b>", SMALL)] + [Paragraph(f"• {escape(o)}", BODY) for o in an.observations]
            if an.regions:
                right += [Paragraph("<b>Areas worth a closer look</b>", SMALL)] + [Paragraph(f"• {escape(r.label.replace('look closer:', '').strip())}", BODY) for r in an.regions]
            right += [Paragraph(f"<b>Photo quality:</b> {an.quality.replace('_', ' ')} &nbsp; <b>Type:</b> {an.image_type.replace('_', ' ')}", SMALL)]
            if an.follow_up_question:
                right += [Paragraph(f"<b>Inspector's follow-up question:</b> {escape(an.follow_up_question)}", SMALL)]
            right += [Paragraph(f"Analysis: {escape(p.analysis_model or 'AI')}", SMALL)]
        t = Table([[_big_img(p, 3.3 * inch), right]], colWidths=[3.45 * inch, 3.75 * inch])
        t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
        s.append(t)

    s += [Paragraph("04 · Likely moisture sources worth checking", H2)]
    seen = set()
    for x in spots:
        for sid, ttl, instr, *_ in photo_plan.SURFACE_SOURCES.get(x["surface"], []) + photo_plan.ROOM_SOURCES.get(x["room"], photo_plan.ROOM_SOURCES["Other"]):
            if ttl not in seen:
                seen.add(ttl)
                s.append(Paragraph(f"• <b>{escape(ttl)}</b> in the {escape(x['room'].lower())}: a common source for this kind of spot, "
                                   "worth checking on site.", BODY))
    if pa:
        s += [Paragraph("05 · What photos can't tell us", H2)] + [Paragraph(f"• {escape(x)}", BODY) for x in pa.cannot_tell]
        s += [Paragraph("06 · Conclusions & recommendations", H2), Paragraph(escape(pa.summary), BODY),
              Paragraph(f"• <b>Recommended next step: {escape(pa.service_price_text)}</b>", BODY)]
        s += [Paragraph(f"• {escape(r)}", BODY) for r in pa.reasons]
        if pa.health_note:
            s.append(Paragraph(f"• {escape(pa.health_note)}", BODY))
        s.append(Paragraph("• Limit time and traffic in the affected area until the recommended step is taken, to avoid spreading spores.", BODY))
    s += [Spacer(1, 8), Paragraph(HEALTH_CANADA, SMALL), Spacer(1, 4), Paragraph(LIMITS, SMALL), Spacer(1, 4),
          Paragraph("If you have any questions regarding this report, please contact Mold Busters at 1-877-566-6653.", SMALL),
          Paragraph(DISCLAIMER, SMALL)]
    return _doc(s)
