# 3. The product

**MoldFlow: from concern to verified quote, and every relationship after it.** One case per customer job (the Evidence Passport) and one profile per person (the Hub), so nothing is lost between tools.

## Who does what
| Stage | AI does | People do |
|---|---|---|
| First contact (web, Bruce, text, email) | Answers instantly, asks the missing questions, creates the contact and case, writes the pre-assessment | Only handle escalations |
| Booking | Offers slots, books, confirms, reminds | Nothing |
| Inspection prep | Builds the inspector's day sheet: concern, access notes, pets, talking points, what photos couldn't show | Read it |
| **Inspection** | Turns field notes into findings and readings | **Inspect** (the one thing AI doesn't do) |
| Report + estimate | Drafts both with a citation on every sentence, runs checks (scope, maths, conflicting records) | Review, edit, approve |
| Follow-up | Drafts follow-up that answers the customer's actual question; watches for estimate expiry | Approve (anything with $ always needs a person) |
| Relationship | Remembers what customers said (with their words and where), schedules the right moments, writes talking points | Approve new facts; use talking points on calls |
| Weather events | Matches Environment Canada rainfall/flood alerts to past customers by postal area; drafts check-ins | Batch-approve |
| Research | Explains lab results from cited sources | Read |

## Part A: MoldFlow (customer journey)
### 1. Customer pre-assessment (phone, no app)
- **Upload path:** guided photos (wide, close, above, nearby); the AI marks "look closer" areas in about 2-3 s; at most 4 tap questions; French and English; resumes if the tab closes; a "use sample photos" escape hatch.
- **Live path, Bruce:** a camera + voice call in the browser.
  - Bruce asks one short question at a time and takes the photos himself ("step back… hold still").
  - He coaches the customer when it's too dark or shaky.
  - He understands plain speech ("nope", "I rent", "K one A zero B one") and finishes in about 4 minutes.
- **Value moment:** a pre-assessment card and PDF.
  - It shows only published prices (virtual $100, on-site $195 + tax, air quality test $520 + tax) and a fixed health note.
  - Tenants get a letter to send their landlord.
  - Out-of-area customers are offered a $25 remote report (simulated checkout).
- **Booking:** pick a weekday slot. Tenants are told to call 1-877-566-6653. There's an optional tip jar and an **unchecked** marketing-consent box with a privacy notice.

### 2. Inspector screen
One note box per room (dictation works). "Structure with AI" turns the note into findings the inspector confirms. Quick-tap readings per test (swab positive/negative, ball slope passed/failed…). Findings the note never mentioned are dropped.

### 3. Review screen
- An AI-drafted report with a citation on every sentence; hovering shows the photo. Uncited sentences are removed.
- Checks lock approval while a blocking issue is open. On Job 1: "the basement swab was positive but the basement isn't in the estimate", plus two conflicting records.
- Two-role approval: "Drafted by MoldFlow · Reviewed by Staff D".
- Exports: a report PDF in Mold Busters' structure, and an estimate CSV shaped for FreshBooks.

### 4. Follow-up and before/after
Follow-up drafts cite the findings and answer the question. The before/after page puts Job 1's four real canned texts next to MoldFlow's message.

### 5. Proof page
What's measured, projected and simulated, plus photo, frame and simulated-call scores, labelled "illustrative, not an accuracy benchmark".

## Part B: the Hub (back office)
| Screen | What it shows | Why it exists |
|---|---|---|
| `/hub` | Needs-you counts; **money on the table** (open estimates, chased → replied → accepted, $ recovered); today's visits; inbound replies; coming-up moments; demo controls | The owner's first question is "where's the money?"; staff need to know what needs them at 8 AM |
| `/people` + profile | Talking points for the next call; what we know (each fact with the customer's words, where they said it, edit/delete); consent; moments; **one timeline across all 7 tools**; take over / hand back | Rockefeller-style memory, but used by people on calls, with sources so staff trust it |
| `/outreach` | Approval queue grouped by reason; batch approve; blocked and held messages with the exact reason; calls & tasks | Approval in seconds, not a 7th inbox |
| `/alerts` | Live Environment Canada check; simulate a rainfall warning over a real forecast zone; matched customers with consent status | Reach the right people when water is coming, legally |
| `/schedule` | Inspector day sheet (phone-first, printable) | Inspectors don't read long briefs; 5 bullets per stop |
| `/research` | Mold library + "explain a lab result" with sources | Answer "what does Stachybotrys mean?" without guessing |
| `/settings` | What AI may send on its own, per message type; kill switch; who processes data | Trust has to be granted gradually, and owners need an off switch |
| `/privacy` | Customer-facing notice in English and French | Law 25 transparency |

### How the hub learns about people
- Facts come from booking notes, staff after-call notes, text and email replies, and Bruce transcripts (only when the call opened with the recording disclosure).
- **Each fact keeps the customer's exact words**; a fact whose quote isn't in the source is dropped.
- Home and preference facts approve themselves. Household, health and life events wait for staff.
- Health facts are never used in messages. Children are stored only coarsely ("school-age child"), never by name, age or school.

### How the hub decides when to reach out
- **Estimate expiry:** 14 days before a viewed-but-not-accepted estimate expires.
- **One year after remediation:** offer a follow-up check.
- **Fact follow-ups:** e.g. before a basement renovation, or before they list the house.
- **Household moments** (back to school, a new baby): become a call-list task for a person, never an automated text.
- **Weather:** a water-related alert covering their postal area. Customers who asked for storm check-ins come first, then past water/basement cases.

### What it will and won't send
Every message goes through one gate, sketched in code below (the order the checks run in). It applies to AI and human messages alike:

```
do-not-contact? → opted out / suppressed? → valid consent for a commercial message? → frequency cap (1 marketing / 7 days)
→ personal facts need personalised-reminders consent → quiet hours (21:00-09:00, held not dropped) → send + footer
```
The footer carries Mold Busters' identity, "Reply STOP to opt out" / "Répondez ARRÊT", and "Automated assistant: reply HUMAN for a person". Details: [06_trust_safety_compliance.md](06_trust_safety_compliance.md).
