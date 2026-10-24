# 9. Presentation outline (slide by slide)

Target 8-10 slides around a live demo. Each slide has a headline, the line to say, what to show and the evidence label.

---

### Slide 1: Title
- **Headline:** MoldFlow: from first concern to accepted quote. AI runs the office; your people inspect.
- **Say:** "We built the AI back office for Mold Busters: it answers, gathers evidence, drafts, follows up and remembers. Your inspectors do what only they can."
- **Show:** the hub screenshot.

### Slide 2: The problem, in your own data
- **Headline:** $4,779 in estimates viewed, never accepted.
- **Say:** "Both sample jobs stalled at 'estimate viewed'. Job 1 asked about the ERMI score and where the moisture was coming from. They got '10% off' and 'should we close your case?'. Job 2 was a tenant with health symptoms; they got plumber referrals."
- **Show:** Job 1's four canned texts; the $4,181 and $597.87 estimates.
- **Label:** from the sample pack.

### Slide 3: Why it happens
- **Headline:** Seven tools, no memory, no answer at 11 PM.
- **Say:** "One customer lives in Calendar, FreshBooks, Asana, Close, Brain, Dialpad and email, and the records disagree. The report took an 82-minute window with two admins and arrived 45 hours after the inspection."
- **Show:** the 7 logos converging to 1; the conflicting records (booked Oct 1 vs "Sept 5").
- **Label:** elapsed times, not labour.

### Slide 4: How we chose what to build
- **Headline:** We let AI agents argue, and kept what's useful.
- **Say:** "Our first idea was mold detection with YOLO. Agents playing you, an engineer and your front-line staff killed it: 24 photos can't train a model, and diagnosing from photos is a liability. Every plan after that was attacked by hostile reviewers before we wrote code."
- **Show:** the funnel: 20 ideas → 10 → MoldFlow → the Hub; 4 red teams; about 45 + 10 + 4 reviews of attacks.
- **Source:** [02_how_we_decided.md](02_how_we_decided.md).

### Slide 5: What MoldFlow does
- **Headline:** AI does everything except the inspection.
- **Show:** the who-does-what table from [03_product.md](03_product.md) (AI column vs People column, with Inspection highlighted).
- **Say:** "People inspect, and approve anything that matters: money, reports, anything personal."

### Slides 6-7: LIVE DEMO
Follow [08_demo_script.md](08_demo_script.md):
1. 11 PM text → instant answer
2. the Job 1 rescue (the before/after moment)
3. the reply becomes memory
4. one timeline
5. rainfall warning check-ins

### Slide 8: Memory, done right
- **Headline:** Rockefeller kept index cards on everyone. We built them, with consent.
- **Say:** "It remembers what customers tell us, in their words, with where they said it. Staff approve it. Family details become talking points for a person, never automated texts. Health is never used in marketing. Customers can see, fix or delete it."
- **Show:** a profile with facts + quotes + source chips; the "for a person to bring up" tag.

### Slide 9: Safe and lawful by construction
- **Headline:** The rules are in the code, not in a policy document.
- **Bullets:**
  - Never diagnoses mold (0/24 overclaims).
  - Prices only from your list.
  - CASL consent and expiry per person.
  - Offers only with consent; safety-only messages otherwise.
  - STOP/ARRÊT and HUMAN keywords.
  - Quiet hours, a cap of 1 marketing message a week.
  - A kill switch on every staff page.
  - The Law 25 notice, in English and French.
- **Source:** [06_trust_safety_compliance.md](06_trust_safety_compliance.md).

### Slide 10: Evidence
- **Headline:** Measured, not vibes.
- **Show:**
  - Photo AI 140 → **162/168**, 0 overclaims, 2.3 s per photo.
  - Bruce 33/44 → **85/88** across 8 personas, 8/8 finished, 0 rule violations (simulated personas).
  - 80 unit tests, 19 browser tests, the whole demo runs offline.
- **Label clearly:** what's projected (conversion lift, staff hours) vs simulated (sending, payments, CRM sync, synthetic customers).
- **Source:** [05_evidence.md](05_evidence.md).

### Slide 11: Fits how you work
- **Headline:** One tab instead of seven, without ripping anything out.
- **Say:** "FreshBooks and Calendar stay. Exports drop into them today. Close sequences, Asana cards and Brain notes get replaced. Day 1, staff approve drafts; as trust grows, you let it send more on its own."
- **Show:** the settings autonomy dial.

### Slide 12: What's next
- **Show:**
  - Connect Twilio/Resend and the Dialpad call logs.
  - FreshBooks/Calendar write-back.
  - Staff login and roles.
  - The customer "what we remember" page.
  - A $25 remote report with partner referrals.
  - The AI-written path on paid models.
- **Ask Michael** the questions in [10_roadmap_and_open_questions.md](10_roadmap_and_open_questions.md).

### Closing line
"Today a customer texts at 11 PM and waits for voicemail. With MoldFlow they get an answer in seconds, a report the same day, and follow-up that answers their real question, while your team spends its time inspecting."
