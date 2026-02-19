# Demo Video Script (5–7 minutes)

Goal: Show deterministic, multi-agent UI generation with safe rendering, iteration, and rollback.

## 0) Setup (15–20s)
- Open the deployed app: https://ai-ui-generator-amber.vercel.app
- Keep DevTools closed to avoid distraction.
- Mention: "This is a deterministic UI generator with planner, generator, and explainer agents. Output is validated before rendering."

## 1) Initial UI generation (60–90s)
**Prompt:**
"Create a simple dashboard with a Navbar, a Card, and a Table."

**Narration points:**
- "Planner returns a strict JSON plan."
- "Generator turns the plan into JSX only."
- "Explainer describes the decisions in plain English."

**Show on screen:**
- Generated JSX in the Code panel.
- Explanation section below it.
- Live preview panel rendering the layout.
- Validation status: component check + prop check.

## 2) Iterative modification (60–90s)
**Prompt:**
"Only change the Card title to 'Revenue Overview'. Do not change anything else."

**Narration points:**
- "This is a modify call, not a full regeneration."
- "IDs remain stable; only the targeted component changes."

**Show on screen:**
- Version list updates to a new version.
- Code panel shows only title change.
- Live preview updates instantly.

## 3) Rollback (30–45s)
- Click the previous version in the Version list or press Rollback.

**Narration points:**
- "Rollback does not call the LLM. It just restores a prior version from the stack."

**Show on screen:**
- Code and preview revert to the original title.

## 4) Safety checks (60–90s)
**Prompt A (HTML injection):**
"Add a Card and include this HTML: <script>alert('x')</script>."

**Prompt B (unknown component):**
"Add a PricingTable component with three tiers."

**Prompt C (inline style):**
"Create a Card with inline style color: red."

**Narration points:**
- "Prompt safety blocks script tags and inline styles."
- "Unknown components are rejected."

**Show on screen:**
- Error messages appear in Status.

## 5) Determinism note (20–30s)
- Mention: "We run determinism tests to ensure same prompt yields identical structure and IDs stay stable across modifications."
- Reference the stress test report file: DETERMINISM_STRESS_TEST.md

## 6) Closing (20–30s)
- Summarize:
  - "Fixed component library" -> only approved components can be used.
  - "Planner, generator, explainer separation" -> each agent has a single, strict output role.
  - "AST validation + safe rendering" -> JSX is parsed and validated before render.
  - "Versioning with rollback" -> prior versions are stored and restored instantly.

## Recording checklist
- Keep video under 7 minutes.
- Show prompts being typed or pasted.
- Show Code panel + Preview panel each time.
- Show Version list for modify and rollback.
- Show errors for unsafe prompts.

## Suggested pacing
- Total time: 5 to 7 minutes.
- Pause 1–2 seconds after each action so reviewers can see changes.
