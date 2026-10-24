# MoldFlow docs: what we built, and why

These docs explain the reasoning behind MoldFlow so the final presentation can be assembled from them. Each file stands on its own. Numbers are labelled **measured**, **from the sample pack**, **projected** or **simulated**, so nothing gets overstated on stage.

## The story in one paragraph
Mold Busters handles each customer across about seven disconnected tools (Google Calendar, FreshBooks, Asana, Close, Brain, Dialpad, email). In both sample jobs the estimate was **sent and viewed, but never accepted: $4,778.87 combined**. The follow-ups were generic and never answered what the customer had actually asked. **MoldFlow** turns the whole journey into one continuous case:
- an AI pre-assessment in the browser, including **Bruce**, the live camera and voice assistant;
- evidence-linked reports and estimates that a person approves;
- follow-up that answers the customer's real question.

The **MoldFlow Hub** adds what a great salesperson does: it remembers the person, notices the right moment (an estimate about to expire, a rainfall warning in their area, a life event they mentioned), and drafts a thoughtful message within Canada's anti-spam and privacy rules. The AI does everything except the inspection. People inspect, and approve anything that matters.

## Read in this order
| # | File | Use it for |
|---|---|---|
| 1 | [01_problem.md](01_problem.md) | The problem, with evidence from the two sample jobs |
| 2 | [02_how_we_decided.md](02_how_we_decided.md) | The process: 10 ideas, multi-agent debate, red teams, and how the concept evolved |
| 3 | [03_product.md](03_product.md) | What MoldFlow does, stage by stage and screen by screen, and who does what |
| 4 | [04_decisions.md](04_decisions.md) | Decision log: every major choice, the alternatives and why |
| 5 | [05_evidence.md](05_evidence.md) | What is measured, what is projected, what is simulated; scores and tests |
| 6 | [06_trust_safety_compliance.md](06_trust_safety_compliance.md) | No-diagnosis rules, human approval, CASL, PIPEDA, Quebec Law 25 |
| 7 | [07_architecture.md](07_architecture.md) | How it works technically, and why each piece exists |
| 8 | [08_demo_script.md](08_demo_script.md) | Demo flow with timings, fallback for each failure, judge Q&A |
| 9 | [09_presentation_outline.md](09_presentation_outline.md) | Slide-by-slide outline with the lines and numbers to use |
| 10 | [10_roadmap_and_open_questions.md](10_roadmap_and_open_questions.md) | What's next, what's not done, questions for Michael |
| 11 | [11_build_journal.md](11_build_journal.md) | Chronological record of what was built, when and why |

## Source material these docs summarise
- `ideation/`: the 10-idea multi-agent debate and the owner's direct feedback (`03_bruce_v2.md`)
- `plan/PLAN.md` (+ `PLAN_v1.md`, `PLAN_v2.md`, `REDTEAM_LOG.md`): the red-teamed MoldFlow build plan
- `plan/OVERNIGHT_LOG.md`: the overnight measure → improve → re-measure cycles for photo AI and Bruce
- `plan/HUB_PLAN.md`: the hub plan and the 4 subagent red-team reviews
- `moldflow/README.md`: how to run everything; `AGENTS.md`: rules for anyone (human or AI) changing the code
