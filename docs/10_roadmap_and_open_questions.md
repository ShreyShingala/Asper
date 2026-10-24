# 10. Roadmap, gaps and open questions

## Not done yet (honest)
| Gap | Why it's not done | What it takes |
|---|---|---|
| Bruce on the real ElevenLabs agent, with real audio | No ElevenLabs key on the build machine | Add the key, run `setup_elevenlabs_agent.py`, then `simulate_call.py --backend elevenlabs` (about 25 text + 5 audio calls) |
| The hub's AI-written messages | The free AI quota was exhausted during the hub build; the reviewed templates ran instead | Nothing to code: the AI path switches on when quota returns; re-run the demo script and compare |
| Real SMS/email | Simulated by design until keys exist | Twilio + Resend in `messaging._deliver()`; inbound webhooks are already shaped like Twilio's |
| Imports from the 7 tools | No API access during the hackathon; synthetic export-shaped data | Close, FreshBooks, Asana, Dialpad and Calendar connectors writing `Interaction` records |
| Staff login and roles | Out of scope for the demo | Simple login; roles: office / inspector / owner; audit profile views |
| Customer "what we remember" page | Deferred after the core loop | `/me/[token]`: view, edit, delete, preferences |
| Remediation follow-through | A crew-scheduling task exists; the lab tracker and clearance letter don't | Task kinds already in the model; add the screens |
| Production compliance | Requires the company's own decisions | Civic address in the footer, privacy officer, privacy impact assessment + data agreements, legal review, French consent text on the booking form |

## Roadmap (in value order)
1. **Go live on messaging:** Twilio/Resend, Dialpad call summaries feeding the after-call note, 48 h + 2 h reminders.
2. **Estimate rescue at scale:** every viewed-but-not-accepted estimate gets a concern-aware follow-up queue; measure the conversion lift against the old canned sequence (an A/B test).
3. **Write-back:** FreshBooks (estimate status, deposit link) and Google Calendar (bookings).
4. **Graduated autonomy:** a per-message-type scorecard ("47 sent, 2 edited, 0 complaints") unlocks "send on its own".
5. **Remote reports + partners:** the $25 out-of-area report; qualified-lead referrals to partners elsewhere.
6. **A data flywheel:** inspector-confirmed photos become a labelled dataset; only then consider a custom detector, still never a diagnosis.

## Questions for Michael
1. Is the virtual inspection free now? The sample pack shows $100 paid. Should we sell an AI-only $25 report outside the service area?
2. Who should approve messages day to day, and which types would you let send on their own first?
3. Which tools could you drop if the hub covered them (Close sequences? Asana cards? Brain?), and which must stay (FreshBooks, Calendar)?
4. Do you want storm check-ins for all past customers who consent, or only those who ask for them?
5. What is your registered civic address for message footers, and who is your privacy officer?
6. Can we get read access (or exports) for Close, FreshBooks and Dialpad to replace the synthetic history?
