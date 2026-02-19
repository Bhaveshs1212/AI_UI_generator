Objective

Redesign the current system to:

Enforce deep AI reasoning before layout generation.

Preserve strict component library usage.

Maintain AST validation and safety.

Maintain deterministic IDs and versioning.

Eliminate rigid template-based outputs.

Ensure domain-aware and context-aware UI generation.

This is not a cosmetic improvement.
This is a reasoning architecture upgrade.

SECTION 1 — Core Design Philosophy

The system must follow:

Prompt
  ↓
Cognitive Reasoning
  ↓
Structured Domain Model
  ↓
Layout Mapping (Strict Components Only)
  ↓
Validated JSX


Intelligence happens in reasoning.

Safety happens in rendering.

SECTION 2 — Updated Agent Architecture
Old Flow (V1)
Prompt → Planner → Generator → Renderer


This skips cognition.

New Flow (V3)
Prompt
   ↓
Reasoning Agent (NEW)
   ↓
Layout Planner
   ↓
Generator
   ↓
Validator
   ↓
Renderer


Reasoning and layout are separate stages.

SECTION 3 — Reasoning Agent (NEW)
Purpose

Build a mental model of the requested system before designing UI.

The Reasoning Agent MUST output structured JSON only.

Reasoning Output Schema
{
  domainModel: {
    productOrSystem: string,
    domainType: string,
    userRole: string,
    primaryGoal: string
  },
  entities: string[],
  insightsRequired: string[],
  metricsToTrack: string[],
  dataModelHints: {
    tablesNeeded: string[],
    chartsNeeded: string[],
    summaryMetricsNeeded: string[]
  }
}

Example

Prompt:

Create a YouTube Studio dashboard


Reasoning Output:

{
  "domainModel": {
    "productOrSystem": "YouTube Studio",
    "domainType": "creator analytics platform",
    "userRole": "content creator",
    "primaryGoal": "monitor channel growth and performance"
  },
  "entities": ["videos", "subscribers", "views", "watch time", "revenue"],
  "insightsRequired": [
    "subscriber growth",
    "video performance ranking",
    "watch time trend",
    "monetization overview"
  ],
  "metricsToTrack": [
    "total subscribers",
    "total views",
    "watch hours",
    "estimated revenue"
  ],
  "dataModelHints": {
    "tablesNeeded": ["top performing videos"],
    "chartsNeeded": ["views over time", "subscriber growth"],
    "summaryMetricsNeeded": [
      "subscribers",
      "views",
      "watch time",
      "revenue"
    ]
  }
}


No JSX here.
No components yet.

SECTION 4 — Layout Planner (STRICT COMPONENT MAPPING)

Layout Planner consumes reasoning JSON.

It must:

Map insights → allowed components.

Never invent new components.

Never output arbitrary JSX.

Only use provided library.

Layout Planner Output Schema
{
  layout: {
    sections: [
      {
        id: string,
        title: string,
        purpose: string,
        components: [
          {
            type: "Card" | "Table" | "Chart" | "Sidebar" | "Navbar",
            id: string,
            props: {}
          }
        ]
      }
    ]
  }
}

SECTION 5 — Generator

Generator must:

Convert structured layout → valid JSX.

Use strict component imports.

Preserve deterministic IDs.

Populate props with realistic data.

Generator must NOT perform reasoning.

Reasoning already happened.

SECTION 6 — Strict Library Enforcement

The AI may only use:

Card

Table

Chart

Button

Input

Modal

Sidebar

Navbar

No new components.

No raw HTML.

No div wrappers beyond allowed layout.

No inline styles.

SECTION 7 — Anti-Template Safeguard

Before layout finalization:

The system must verify:

Are metrics domain-aligned?

Are generic placeholders present?

Are marketing metrics inserted for non-marketing domains?

If mismatch detected:

Re-run reasoning.

SECTION 8 — Modification Flow

Modify must:

Re-run reasoning if domain changes.

Update only affected sections.

Preserve existing IDs.

Preserve unaffected components.

Maintain domain coherence.

SECTION 9 — Explanation Agent Upgrade

Explainer must reference reasoning:

Example:

“Since this request references YouTube Studio, I identified the core entities as videos, subscribers, and watch time. I structured the layout to prioritize growth metrics and video performance insights.”

Explanation must reflect domain reasoning.

SECTION 10 — Deterministic Guarantees

Maintain:

AST parsing before render.

Component whitelist validation.

Prop schema validation.

No eval.

No arbitrary JSX execution.

ID stability across versions.

Strict modify diff logic.

Reasoning must not compromise safety.

SECTION 11 — Mandatory Reasoning Contract

The Reasoning Agent prompt must enforce:

Identify domain.

Identify user role.

Identify primary goal.

Identify entities.

Identify insights required.

Identify realistic metrics.

Output JSON only.

Do NOT generate layout.

This is mandatory.

SECTION 12 — Evaluation Criteria

The upgraded system must pass:

Test 1

Prompt:

inventory management dashboard


Must not contain:

CTR

CPC

Conversion Rate

Must contain:

Stock

Inventory

Product-related metrics.

Test 2

Prompt:

YouTube Studio dashboard


Must contain:

Subscribers

Views

Watch time

Video performance.

Test 3

Prompt:

Financial summary report


Must contain:

Revenue

Expenses

Profit.

SECTION 13 — Implementation Tasks

Coding LLM must:

Create reasoning.ts agent.

Update planner.ts to consume reasoning.

Enforce reasoning-first architecture.

Update prompts.ts with mandatory reasoning contract.

Maintain generator logic.

Preserve validation layer.

Add domain coherence check before render.

SECTION 14 — Non-Negotiables

Do NOT:

Remove component restrictions.

Allow arbitrary JSX.

Remove AST validation.

Remove deterministic IDs.

Hardcode domain → metric mappings.

Implement rule-based switch-case logic.

All domain intelligence must come from LLM reasoning.

FINAL INSTRUCTION TO CODING LLM

Refactor the architecture to enforce reasoning-first UI generation while preserving strict component constraints and safety validation.

The system must demonstrate domain-aware, context-aware intelligence before layout mapping.

Intelligence and safety must coexist.