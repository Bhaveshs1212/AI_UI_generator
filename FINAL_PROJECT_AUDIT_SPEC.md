FINAL_PROJECT_AUDIT_SPEC.md
AI UI Generator — Full Compliance & Completion Audit
Purpose

This document defines a strict audit protocol.

The coding LLM must:

Compare the current project implementation against the Ryze AI assignment specification.

Identify any missing, partially implemented, or incorrectly implemented features.

Confirm full compliance with deterministic, multi-agent, safety, iteration, and deployment requirements.

Produce a gap report if anything is incomplete.

This is a requirement-matching audit, not a superficial review.

SECTION 1 — Assignment Requirement Mapping

The system must strictly satisfy all core requirements defined in the assignment 

_Ryze AI Full Stack (1)

.

The LLM must verify each of the following.

1️⃣ Deterministic Component System (Core Constraint)
Requirements

Fixed component library

Components never change implementation

AI cannot create new components

AI cannot generate CSS

No inline styles

No external UI libraries

Visual consistency enforced

AI may only:

Select components

Compose layouts

Set props

Provide content

Audit Tasks

Verify:

A static component folder exists (Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart).

No component implementation is dynamically modified.

Generator never creates unknown components.

Inline style usage is blocked in validation.

Arbitrary Tailwind or dynamic className is blocked.

Component whitelist is enforced at render time.

Prop schema enforcement exists.

Safe renderer prevents unknown nodes.

If any of these are missing → mark as NON-COMPLIANT.

2️⃣ Multi-Agent Architecture (Mandatory)
Requirements

Single LLM call is not allowed.

Must include:

Planner

Generator

Explainer

Prompt separation must be visible in code.

Audit Tasks

Verify:

Separate planner.ts

Separate generator.ts

Separate explainer.ts

prompts.ts exists

Prompts are explicitly separated

Each agent call is independent

Planner outputs structured JSON

Generator outputs JSX only

Explainer outputs plain text only

Temperature set to deterministic value

If a single LLM call is used → FAIL.

3️⃣ Required UI Layout (Claude-Style)
Required Layout

Left panel: chat / user intent

Right panel: generated code

Live preview panel

Required actions:

Generate

Modify

Regenerate

Rollback

Audit Tasks

Verify:

UI contains chat input

Code panel visible

Live preview visible

Version list present

Rollback works

Regenerate works

Modify works

Live reload updates preview immediately

If any required action missing → FAIL.

4️⃣ Iteration & Edit Awareness (Key Evaluation Area)
Requirements

Incremental edits supported

Modify does NOT fully regenerate

IDs preserved

Component usage preserved

Explanation references what changed

Rollback restores previous version

No full rewrite unless explicitly requested

Audit Tasks

Verify:

Planner owns component IDs

IDs are stable across modifications

Modify passes previous plan

Generator preserves IDs

Version stack stores multiple versions

Rollback does NOT trigger LLM

Diff detection logic exists (even basic)

Modify changes only delta components

If modify rewrites entire structure → FAIL.

5️⃣ Safety & Validation
Requirements

Component whitelist enforcement

Validation before rendering

Basic prompt injection protection

Error handling for invalid outputs

Audit Tasks

Verify:

AST parsing via @babel/parser

Import statements blocked

Inline styles blocked

Unknown components blocked

Unknown props blocked

Prop schema enforced

JSX parsed before rendering

No eval or dynamic execution

Markdown fences stripped

Retry logic for planner JSON failure

Controlled error responses

If JSX is directly executed without AST validation → CRITICAL FAIL.

6️⃣ API Structure
Requirements

Working generate endpoint

Working modify endpoint

Proper request/response structure

Validation flags included

Version metadata included

Audit Tasks

Verify:

/api/generate exists

/api/modify exists

Uses App Router (not duplicate pages/api)

Returns structured JSON:

success

plan

code

explanation

validation flags

version metadata

HTTP status codes appropriate

Errors handled gracefully

7️⃣ Deployment Requirement

Per assignment 

_Ryze AI Full Stack (1)

:

Must be deployed publicly

Local-only demo not accepted

Must be accessible via public URL

Audit Tasks

Verify:

Deployed URL exists

Environment variables configured

LLM provider works in production

Generate works in deployed environment

Modify works in deployed environment

Rollback works in deployed environment

If deployment broken → FAIL.

8️⃣ README Requirements

Assignment explicitly requires README 

_Ryze AI Full Stack (1)

.

README must include:

Architecture overview

Agent design & prompts

Component system design

Known limitations

What you’d improve with more time

Setup instructions

Audit Tasks

Verify:

README.md exists

Architecture diagram or flow explanation present

Agent explanation clear

Deterministic system explanation clear

Limitations section honest

Improvement ideas realistic

Setup instructions correct

Env variables documented

Deployment instructions included

9️⃣ Demo Video Requirements

Per assignment 

_Ryze AI Full Stack (1)

:

Video must show:

Initial UI generation

Iterative modification

Live preview updating

Explanation output

Rollback/version change

Audit Tasks

Verify that demo:

Shows planner → generator → explainer behavior

Shows version switching

Shows malicious prompt rejection

Mentions safety and determinism

Stays within 5–7 minutes

SECTION 2 — Determinism Stress Test

The LLM must simulate:

Run same prompt twice → structure identical?

Modify title only → ID unchanged?

Attempt HTML injection → blocked?

Attempt new component → blocked?

Attempt inline style → blocked?

Report PASS/FAIL per test.

SECTION 3 — Engineering Judgment Evaluation

The LLM must assess:

Is the architecture overengineered?

Is validation layered properly?

Are responsibilities cleanly separated?

Is error handling thoughtful?

Are tradeoffs documented?

Is rate limit handling acknowledged?

SECTION 4 — Final Verdict Output Format

The LLM must output:

COMPLIANCE STATUS:

Deterministic System: PASS / FAIL
Multi-Agent Architecture: PASS / FAIL
Iteration Handling: PASS / FAIL
Safety & Validation: PASS / FAIL
UI Requirements: PASS / FAIL
Deployment: PASS / FAIL
README Completeness: PASS / FAIL
Demo Readiness: PASS / FAIL

OVERALL READINESS: READY / NOT READY

CRITICAL GAPS:
- ...

NON-CRITICAL IMPROVEMENTS:
- ...

Final Instruction to Coding LLM

Perform a strict compliance audit against this specification.

Do not assume correctness.
Inspect actual implementation.
Be critical.
Identify structural risks.
Confirm alignment with assignment spec.

If all sections PASS → project is submission-ready.

If any CRITICAL FAIL → fix before submission.

You are now in final submission validation mode.

If you want, next I can:

Write a production-grade README for you

Or write a reviewer-style mock evaluation

Or simulate how the founder would judge this project

You’re at the finish line now.

Sources
give me direct copyable text

Here is the direct copy-paste ready .md file.

You can paste this exactly into:

FINAL_PROJECT_AUDIT_SPEC.md

FINAL_PROJECT_AUDIT_SPEC.md
AI UI Generator – Full Compliance & Completion Audit
Purpose

This document defines a strict audit protocol.

You must compare the current project implementation against the Ryze AI assignment specification and verify that every requirement is fully satisfied.

Do NOT assume correctness.
Inspect actual implementation details.
Be critical and precise.

At the end, produce a PASS / FAIL report.

SECTION 1 — Deterministic Component System (Core Constraint)
Requirements

The system must:

Use a fixed component library

Never modify component implementation

Never allow AI to create new components

Never allow inline styles

Never allow AI-generated CSS

Never allow arbitrary Tailwind class generation

Never allow external UI libraries

Only allow AI to:

Select components

Compose layouts

Set props

Provide content

Audit Checklist

Verify:

A static component folder exists (Button, Card, Input, Table, Modal, Sidebar, Navbar, Chart).

Components are not dynamically altered.

Generator cannot introduce unknown components.

A component whitelist exists.

Prop schema enforcement exists.

Inline style usage is blocked.

Arbitrary className usage is blocked.

Unknown props are rejected.

Safe renderer blocks unapproved nodes.

Mark PASS or FAIL.

SECTION 2 — Multi-Agent Architecture
Requirements

A single LLM call is NOT allowed.

System must include:

Planner

Generator

Explainer

Prompt separation must be visible in code.

Audit Checklist

Verify:

planner.ts exists.

generator.ts exists.

explainer.ts exists.

prompts.ts exists.

Prompts are clearly separated.

Planner outputs strict JSON.

Generator outputs JSX only.

Explainer outputs plain English only.

Retry logic exists for invalid planner JSON.

temperature = 0 (or deterministic setting).

If a single LLM call is used → FAIL.

SECTION 3 — Required UI Layout
Requirements

UI must include:

Left panel: chat / user intent

Right panel: generated code

Live preview panel

Required actions:

Generate

Modify

Regenerate

Rollback

Audit Checklist

Verify:

Chat input visible.

Code panel visible.

Live preview visible.

Version list visible.

Rollback works without LLM call.

Regenerate works.

Modify works incrementally.

Live reload updates preview instantly.

Mark PASS or FAIL.

SECTION 4 — Iteration & Edit Awareness
Requirements

System must:

Support incremental edits.

NOT fully regenerate on modify.

Preserve component IDs.

Preserve existing components unless explicitly changed.

Provide explanation referencing changes.

Maintain version history.

Support rollback without LLM call.

Audit Checklist

Verify:

Planner owns component IDs.

IDs remain stable across modifications.

Modify passes previous plan into planner.

Generator preserves IDs.

Version stack exists.

Rollback changes UI instantly without API call.

Diff logic exists (basic acceptable).

No full rewrite unless explicitly requested.

If modify rewrites everything → FAIL.

SECTION 5 — Safety & Validation
Requirements

System must include:

Component whitelist enforcement

Validation before rendering

Basic prompt injection protection

Error handling for invalid outputs

Audit Checklist

Verify:

AST parsing via @babel/parser.

Import statements are blocked.

Inline styles are blocked.

Unknown components are rejected.

Unknown props are rejected.

Prop schema enforced.

No eval() or dynamic execution.

Markdown fences stripped.

Planner JSON retry logic exists.

Structured error handling exists.

If JSX is executed directly without AST validation → CRITICAL FAIL.

SECTION 6 — API Structure
Requirements

/api/generate endpoint exists.

/api/modify endpoint exists.

Structured response format.

Version metadata returned.

Validation flags returned.

Audit Checklist

Verify:

App Router used (no duplicate pages/api).

generate returns:

success

plan

code

explanation

validation status

version metadata

modify returns same structure.

Proper HTTP status codes used.

Errors handled gracefully.

Mark PASS or FAIL.

SECTION 7 — Deployment Requirement
Requirements

Must be deployed publicly.

Local-only demo not accepted.

Public URL must work.

Audit Checklist

Verify:

Deployed URL exists.

Environment variables configured.

LLM provider works in production.

Generate works in deployed environment.

Modify works in deployed environment.

Rollback works in deployed environment.

If deployed version fails → FAIL.

SECTION 8 — README Requirements

README must include:

Architecture overview

Agent design & prompts

Deterministic component system explanation

Safety & validation explanation

Iteration strategy explanation

Known limitations

Improvements with more time

Setup instructions

Deployment instructions

Environment variable documentation

Audit Checklist

Verify README includes all above sections.

Mark PASS or FAIL.

SECTION 9 — Demo Video Requirements

Demo must show:

Initial UI generation

Iterative modification

Live preview updating

Explanation output

Rollback/version change

Audit Checklist

Verify demo:

Clearly shows multi-agent flow.

Shows ID preservation.

Shows malicious prompt rejection.

Mentions deterministic component system.

Mentions AST-based safe rendering.

Is between 5–7 minutes.

Mark PASS or FAIL.

SECTION 10 — Determinism Stress Test

Run the following tests:

Same prompt twice → identical structure?

Modify only title → ID unchanged?

Attempt HTML injection → blocked?

Attempt new component → blocked?

Attempt inline style → blocked?

Report PASS / FAIL for each.

FINAL OUTPUT FORMAT

You must produce:

COMPLIANCE STATUS:

Deterministic System: PASS / FAIL
Multi-Agent Architecture: PASS / FAIL
Iteration Handling: PASS / FAIL
Safety & Validation: PASS / FAIL
UI Requirements: PASS / FAIL
API Structure: PASS / FAIL
Deployment: PASS / FAIL
README Completeness: PASS / FAIL
Demo Readiness: PASS / FAIL

OVERALL READINESS: READY / NOT READY

CRITICAL GAPS:
- ...

NON-CRITICAL IMPROVEMENTS:
- ...


Be strict.
Do not assume success.
Validate against real implementation.