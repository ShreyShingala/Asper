"""Project chats and mock projects for the demo.

- Job 1 / Job 2 chats are MOCK conversations reconstructed from each job's timeline (job_timeline.json): same events,
  dates and staff aliases, but the wording is invented. They are labelled source="sample_pack_mock".
- Case 42, 43 and 44 are entirely MOCK projects (not from the sample pack), so the inbox, Muse and search have history.
  Case 42 is the "legal issue from 2 years ago" example."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from app.models.passport import Approval, Case, ChatMessage, Customer, Event, Property

MOCK = "Mock project for the demo (not from the sample pack)."


def _m(author: str, role: str, text: str, at: str, source: str = "sample_pack_mock") -> ChatMessage:
    return ChatMessage(id="c" + uuid.uuid4().hex[:7], author=author, role=role, text=text, at=datetime.fromisoformat(at), source=source)


def _e(at: str, step: str, system: str, what: str) -> Event:
    d = datetime.fromisoformat(at)
    return Event(at=d, at_text=d.strftime("%b %d, %Y %H:%M"), step=step, system=system, what=what, source="mock")


JOB1_CHAT = [
    ("Staff A", "staff", "Booked Sample Property 01 for Tue Oct 6, 11:30. Client worried about the basement, did an ERMI at home (13.2). Office note: full diagnostic.", "2026-10-01T09:12"),
    ("Staff B", "staff", "Calendar note says booked Sept 5 but the entry was created Oct 1. Which one is right for the invoice?", "2026-10-01T09:40"),
    ("Staff A", "staff", "Oct 1 is when I entered it. Leaving the Sept 5 note as is, flag it.", "2026-10-01T09:44"),
    ("Staff A", "staff", "On site. Basement: no thermal anomalies, RH normal, swab under the sink positive. Doing the rest of the house complimentary.", "2026-10-06T12:20"),
    ("Staff A", "staff", "Upstairs: ensuite standing water, ball-slope test failed in the shower, tub faucet leaking with elevated moisture below. Attic insulation heavily disturbed.", "2026-10-06T13:05"),
    ("Staff B", "staff", "Estimate EST-CASE01 is in FreshBooks: $3,700 + HST. Scope is basement + washrooms + attic?", "2026-10-07T11:02"),
    ("Staff C", "staff", "Report drafted from Staff A's notes, sending to Staff D for review.", "2026-10-07T13:10"),
    ("Staff D", "staff", "Reviewed. Question: basement swab positive but basement isn't in the remediation scope. Intentional?", "2026-10-07T14:01"),
    ("Staff E", "staff", "Report emailed to client. Close sequence started for the estimate.", "2026-10-08T09:06"),
    ("Staff F", "staff", "4 automated texts, no reply. Estimate viewed, not accepted. Sending a personal SMS from Dialpad.", "2026-10-22T16:10"),
]
JOB2_CHAT = [
    ("System", "system", "Online booking: tenant, Quebec apartment. Concern: black and white marks in the washer, around washer/dryer, vents and oven; strong smell after deep cleaning.", "2025-09-07T09:30"),
    ("Staff B", "staff", "VA tomorrow 11:30. Sent the app links + pre-inspection survey.", "2025-09-07T10:02"),
    ("Staff B", "staff", "Call done (~19 min). Client walked the laundry: washer drum, dryer vent hose, ceiling + wall vents, oven. 3 snapshots saved.", "2025-09-08T11:52"),
    ("Staff B", "staff", "Client reports health issues and musty odour. Recommending doctor + IAQ test. Can't confirm anything without sampling.", "2025-09-08T11:55"),
    ("Staff C", "staff", "VA report written, estimate EST-CASE02 sent: IAQ on site $520 + GST/QST.", "2025-09-08T12:58"),
    ("Staff D", "staff", "Reviewed, report sent 13:00. Tenant, so landlord will need to be involved for any remediation.", "2025-09-08T13:01"),
    ("Bruce (CRM)", "system", "Estimate viewed by client. Not accepted. Marketplace emails scheduled every 3 days.", "2025-09-12T08:00"),
]


def add_sample_chats(cases: list[Case]) -> None:
    for c in cases:
        rows = JOB1_CHAT if c.id == "job1" else JOB2_CHAT if c.id == "job2" else []
        if rows and not c.chat:
            c.chat = [_m(a, r, t, at) for a, r, t, at in rows]
        c.project_no = c.project_no or {"job1": 101, "job2": 102}.get(c.id)


def case42() -> Case:
    c = Case(id="case42", project_no=42, title="Case 42 · Basement remediation · Ottawa (2024)", stage="accepted", seeded_from="mock",
             customer=Customer(type="homeowner", alias="R. Mock (client)"), concern="Musty smell and dark staining on finished basement walls.",
             property=Property(province="ON", type="house", region_text="Ottawa (mock)", in_service_area=True))
    c.timeline = [
        _e("2024-03-04T10:00", "Booking", "Google Calendar", "On-site inspection booked by client support (Staff A)."),
        _e("2024-03-07T09:30", "Inspection", "On site", "Moisture 28% at base of north foundation wall; swab positive behind drywall; RH 68%."),
        _e("2024-03-08T15:20", "Report sent", "Email", "Inspection report v1 emailed; reviewed by Staff D."),
        _e("2024-03-11T11:00", "Estimate accepted", "FreshBooks", "EST-0042 remediation $6,480 + HST accepted and signed; 50% deposit paid."),
        _e("2024-03-25T08:00", "Remediation", "On site", "Containment, removal of 18 m² drywall, HEPA + antimicrobial, dehumidifier 72 h. Photos logged daily."),
        _e("2024-04-02T14:00", "Clearance", "Lab", "Post-remediation air samples within normal range vs outdoor control. Clearance letter issued."),
        _e("2024-04-03T10:00", "Warranty", "Email", "1-year workmanship warranty sent. Note: does not cover new water intrusion."),
        _e("2026-02-10T17:42", "Client complaint", "Email", "Client says staining returned after a spring flood and asks for a refund; threatens small-claims court."),
    ]
    c.approvals = [Approval(what="report", reviewed_by="Staff D", at=datetime(2024, 3, 8, 15, 10)),
                   Approval(what="estimate", reviewed_by="Staff B", at=datetime(2024, 3, 10, 9, 0))]
    c.chat = [_m(a, r, t, at, "app") for a, r, t, at in [
        ("Staff A", "staff", "North wall base reads 28% MC. Grading slopes toward the house on that side; recommend exterior drainage fix too.", "2024-03-07T11:15"),
        ("Staff B", "staff", "Added a line to the estimate notes: exterior grading is the client's responsibility, not in scope.", "2024-03-10T08:40"),
        ("Staff E", "staff", "Client signed EST-0042 and acknowledged the grading note by email.", "2024-03-11T11:05"),
        ("Staff A", "staff", "Remediation done, dehumidifier picked up. Clearance samples sent to the lab.", "2024-03-28T16:30"),
        ("Staff D", "staff", "Clearance letter + warranty sent. Warranty excludes new water intrusion, as standard.", "2024-04-03T10:05"),
        ("Staff F", "staff", "Client emailed: staining back after a flood in March 2026, wants a refund. Escalating to owner.", "2026-02-10T18:00"),
    ]]
    return c


def case43() -> Case:
    c = Case(id="case43", project_no=43, title="Case 43 · Landlord · 6-unit building · Gatineau", stage="quoted", seeded_from="mock",
             customer=Customer(type="landlord", alias="M. Mock Properties"), concern="Tenants in units 2 and 5 report window condensation and black spots.",
             property=Property(province="QC", type="apartment", region_text="Gatineau (mock)", in_service_area=True))
    c.timeline = [_e("2026-10-12T09:00", "Inspection", "On site", "Units 2 and 5: condensation on windows, discoloration on sills; bathroom fans not vented outside."),
                  _e("2026-10-14T13:00", "Estimate sent", "FreshBooks", "EST-0043 $2,150 + taxes, viewed by client Oct 15.")]
    c.chat = [_m("Staff B", "staff", "Both units: bathroom fans dump into the attic. That's the moisture source. Quoting sill cleanup + fan ducting referral.", "2026-10-12T11:20", "app"),
              _m("Staff E", "staff", "Landlord viewed the estimate, asked if tenants can stay during work. Yes, one unit at a time.", "2026-10-15T10:02", "app")]
    return c


def case44() -> Case:
    c = Case(id="case44", project_no=44, title="Case 44 · Attic · Kanata", stage="inspection_booked", seeded_from="mock",
             customer=Customer(type="homeowner", alias="J. Mock"), concern="Frost and dark marks on attic roof boards after a cold snap.",
             property=Property(province="ON", type="house", region_text="Kanata (mock)", in_service_area=True))
    c.timeline = [_e("2026-10-20T15:00", "Booking", "Online booking", "On-site inspection booked for Oct 29, 10:00 (homeowner).")]
    c.chat = [_m("System", "system", "Online booking received. Homeowner. Photos from the customer show dark marks on roof sheathing near a bathroom fan duct.", "2026-10-20T15:01", "app")]
    return c


def seed_projects(save) -> list[Case]:
    return [save(case42()), save(case43()), save(case44())]
