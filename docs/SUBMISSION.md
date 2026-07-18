# Devpost submission package

## Project name

Classroom Mirror

## Tagline

A flight simulator for lessons—find the barrier before a learner does.

## Category

Education

## Short description

Classroom Mirror stress-tests a lesson plan through four focused learner-analysis lenses before it reaches a real classroom. GPT-5.6 coordinates the reviews in parallel, grounds every surviving finding in an exact lesson quote, challenges each claim with a skeptical verification pass, and proposes a redesigned learning path. Teachers accept or skip every recommendation and export their decisions.

## Full description

Teachers often discover misconception-producing examples, inaccessible entry points, and missing feedback loops only while a lesson is already underway. Most AI education tools generate more content; Classroom Mirror performs a pre-mortem on the lesson a teacher already intends to teach.

In live mode, Classroom Mirror uses a two-stage GPT-5.6 Responses API workflow. Hosted Multi-agent discovery lets the root handle conceptual clarity while three bounded subagents independently review academic language, attention and feedback, and transfer. A second direct GPT-5.6 call challenges the candidate findings and produces strict structured output. Each finding must include the smallest exact supporting passage. The server independently removes quotes that are not literal substrings of the submitted lesson, providing another grounding boundary.

The result is an evidence ledger rather than a generic scorecard. Teachers retain authority by accepting or skipping individual interventions. Classroom Mirror then presents a revised sequence and diagnostic exit ticket while preserving the lesson’s original goal.

The repository includes an instant no-key demo, strict structured outputs, mocked provider contract tests, input and output safety checks, and a live-only evaluation harness with six benchmark lessons and twelve deliberately planted instructional failures. On the completed GPT-5.6 Sol run, Classroom Mirror detected all 12 planted risks and grounded all 28 returned findings in exact lesson quotes—100% planted-risk recall and 100% exact-quote grounding on this benchmark. The cases and saved result are included for reproducibility; this is a bounded benchmark result, not a claim of universal accuracy.

## How GPT-5.6 is used

- Hosted Multi-agent orchestration with four parallel lesson-review lenses
- Root-agent reconciliation and skeptical verification
- Structured outputs for a stable, inspectable evidence ledger
- Reasoning over long, unstructured lesson plans
- Instructional redesign that preserves the teacher’s goal

## How Codex was used

Codex was the primary development environment from the initial empty repository through product strategy, official API research, implementation, design, test generation, evaluation design, and submission preparation. A pivotal Codex critique identified that simulated learner personas alone were not credible enough; the product was redesigned around exact evidence, adversarial verification, teacher control, and reproducible evaluation.

## URLs to complete

- Public demo: `TODO`
- Code repository: `TODO`
- Public YouTube video: `TODO`
- Codex `/feedback` Session ID: `TODO — obtain from this primary task`

## Final checklist

- [x] Live GPT-5.6 smoke test passes
- [x] Live benchmark results saved and documented without exaggeration
- [ ] Public demo deployed safely; do not expose an unrestricted paid API endpoint
- [ ] Personal Git identity confirmed; no work email in commit history
- [ ] Repository pushed to personal account and made public with MIT license
- [ ] README links verified from a clean clone
- [ ] Video is public, under three minutes, and includes narration
- [ ] Video explicitly demonstrates Codex and GPT-5.6 usage
- [ ] `/feedback` run in the primary Codex task
- [ ] Devpost fields and URLs completed
- [ ] Submission finalized before July 21, 2026 at 5:00 PM PT
