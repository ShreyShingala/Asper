# 6. Trust, safety and compliance

**Why this matters for the pitch:** an AI that texts customers and remembers family details is only practical if it's safe and lawful. These rules are built into the code, so a busy day or a clever prompt can't skip them.

## Safety rules (all AI output)
| Rule | Where it's enforced |
|---|---|
| Never diagnose or confirm mold; never name a species from a photo | Photo prompt + an overclaim check in scoring (0 / 24 overclaims); boxes are labelled "look closer"; mold identity only from lab results (`/research`) |
| Never give medical advice | A fixed reply in code: "We can't give medical advice, so please check with a doctor", then an air quality test offer |
| Never invent prices or discounts | Prices only from `pricing.yaml`; offer check; anything with $ locked to a person |
| Bruce never asks for name, phone or email during the call, and never mentions prices | Prompt + simulated-call rule checks (0 violations) |
| Every sentence in a report is cited | Uncited claims are dropped before staff see the draft |
| Facts must quote the customer verbatim | A grounding check drops facts whose quote isn't in the source |

## Canadian anti-spam law (CASL)
| Requirement | How MoldFlow does it |
|---|---|
| Commercial messages need consent | Consent recorded per channel: **express**, **implied after a purchase (2 years)**, **implied after an inquiry (6 months)**, or **none**, with the date, how it was given and the evidence (form, invoice) |
| A safety check-in with a booking link is commercial | Two kinds of storm message: **safety-only** (no link or offer; allowed without marketing consent, once per alert) and **with an offer** (needs valid consent) |
| Identify the sender; working unsubscribe | Footer added by code to every message: company, site, phone; "Reply STOP to opt out" / "Répondez ARRÊT pour vous désabonner" |
| Honour opt-outs | STOP / ARRÊT / unsubscribe → opted out immediately; identifier added to a suppression list that survives contact merges |
| Don't fabricate consent | Imported contacts start with "no consent" unless the record shows a purchase date |
| Keep proof | Every send, block, edit and approval goes to an audit log |

Also built in: quiet hours (21:00-09:00, the message is held, not dropped), at most 1 marketing message per contact per 7 days, a do-not-contact flag, and a kill switch in every staff header.

## Privacy: PIPEDA and Quebec Law 25
| Requirement | How MoldFlow does it |
|---|---|
| Tell people when automated tools build a profile (Law 25 s.8.1) | A profiling notice on the booking form (EN), and a `/privacy` page in English and French |
| Disclose automated decisions / AI senders (Law 25 s.12.1) | "Automated assistant: reply HUMAN for a person" on AI-sent messages; HUMAN hands the thread to staff |
| Sensitive information (health) | Health facts can never be used in messages (enforced in the data model) and are never sent to the drafting AI; hidden from talking points |
| Information about children | Stored only coarsely ("school-age child", "expecting a baby"): never names, ages or schools; such moments become a call task for a person |
| Recordings and transcripts | Bruce opens with "This call is recorded and transcribed"; transcripts feed memory only if that disclosure was given |
| Accuracy, correction, deletion | Every fact can be edited (with an edit log) or deleted; deleted means removed |
| Data minimisation / retention | Rejected facts deleted; facts expire after 3 years unless re-confirmed |
| Cross-border processing | `/settings` lists who processes data (OpenRouter, ElevenLabs, Twilio, Resend in the US; Environment Canada); a privacy impact assessment and data agreements are flagged as required before production |
| No targeting by age | Storm check-ins go to people who opted in to "please check on me", not to "old people" |

## Still needed before real customers (honest list)
- Mold Busters' registered civic address in the message footer (`consent.ADDRESS`)
- A designated privacy officer, published on the site
- A privacy impact assessment and data-processing agreements for the US processors
- Staff login with roles (office / inspector / owner), with profile views audited
- Legal review of the notice and consent wording (drafted from the privacy reviewer's suggested text)
- French versions of the booking-form consent text (the `/privacy` page is already EN/FR)
