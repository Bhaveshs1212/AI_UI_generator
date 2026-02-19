Objective

Upgrade the current AI UI Generator system to:

Eliminate template bias (e.g., default marketing dashboards).

Add domain-aware reasoning.

Generate domain-specific metrics and data.

Improve perceived AI intelligence.

Maintain deterministic safety constraints.

The system must feel context-aware and adaptive.

SECTION 1 — Problem Diagnosis (V1 Failure)
Observed Issue

Prompt:

create an inventory management dashboard


Output:

Total Revenue

Conversion Rate

Active Users

Marketing segment table

Generic trend chart

This indicates:

No domain extraction.

No semantic reasoning.

Template fallback behavior.

Marketing analytics bias.

This is not acceptable for V2.

SECTION 2 — V2 Architecture Upgrade

We introduce a mandatory reasoning stage before layout planning.

Updated Agent Flow
User Input
   ↓
Domain Extractor (NEW)
   ↓
Intent Classifier (NEW)
   ↓
Semantic Planner (Upgraded)
   ↓
Data Synthesizer (Upgraded)
   ↓
Generator
   ↓
Validator
   ↓
Explainer

SECTION 3 — Domain Extraction Layer (NEW)
Purpose

Extract domain entities and vocabulary from prompt before planning.

Domain Extractor Output Schema
{
  domain: string,
  keyEntities: string[],
  inferredIndustry: string,
  operationalConcepts: string[]
}

Example

Input:

create an inventory management dashboard


Output:

{
  "domain": "inventory_management",
  "keyEntities": ["inventory", "products", "stock", "warehouse"],
  "inferredIndustry": "operations/logistics",
  "operationalConcepts": ["stock levels", "reorder threshold", "supply chain"]
}


This output must feed into Planner.

SECTION 4 — Intent Classification Layer (NEW)

Classify intent type:

{
  intentType: "dashboard" | "report" | "form" | "crud" | "marketing_page",
  complexity: "simple" | "moderate" | "complex"
}


Example:

create an inventory management dashboard


→ intentType: "dashboard"

SECTION 5 — Semantic Planner Upgrade

Planner must now use:

domain

keyEntities

operationalConcepts

intentType

Planner must generate domain-aligned layout.

Planner Output Schema
{
  intentAnalysis: {...},
  domainAnalysis: {...},
  layoutStrategy: string,
  sections: [
    {
      id: string,
      title: string,
      purpose: string,
      components: [...]
    }
  ],
  dataRequirements: {...}
}


Planner must NOT default to marketing KPIs unless domain matches marketing.

SECTION 6 — Domain-Specific Metric Generation Rules
RULE: Metrics must align with extracted domain.
If domain contains:
inventory / warehouse / stock

Metrics should include:

Total Products

Low Stock Items

Out of Stock Items

Reorder Alerts

Warehouse Capacity Used

crm / sales

Metrics:

Total Deals

Closed Deals

Pipeline Value

Conversion Rate

saas / product

Metrics:

MRR

ARR

Churn

DAU / MAU

marketing / ads

Metrics:

CTR

CPC

Impressions

Conversions

Marketing metrics must NOT appear in inventory dashboards.

SECTION 7 — Data Synthesizer Upgrade

Data must be realistic and domain-aware.

For inventory:

Table columns:

Product Name

SKU

Quantity

Reorder Level

Status

Rows must include:

Realistic product names

Numeric quantities

Status derived from quantity vs reorder level

Example:

{
  "rows": [
    {
      "Product Name": "Wireless Mouse",
      "SKU": "WM-203",
      "Quantity": 12,
      "Reorder Level": 20,
      "Status": "Low Stock"
    }
  ]
}


Status must be logically consistent.

SECTION 8 — Generator Upgrade

Generator must:

Use Planner structured output.

Populate props with domain-specific data.

Generate meaningful titles.

Maintain component ID determinism.

Example JSX:

<Card id="inventory-summary" title="Inventory Overview">
  ...
</Card>

<Table id="product-stock-table" ... />

<Chart id="stock-trend-chart" ... />

SECTION 9 — Anti-Template Safeguard

Planner must include validation step:

Before finalizing layout:

Check:

Do generated metrics match domain?

Are irrelevant industry metrics present?

Does layout reflect operational context?

If mismatch → regenerate internally.

SECTION 10 — Explainer Upgrade

Explainer must reference:

Extracted domain

Intent classification

Metric reasoning

Section purpose

Example:

“Since the user requested an inventory management dashboard, I included metrics such as total products, low stock items, and reorder alerts. I also generated a stock-level table to reflect operational visibility.”

This demonstrates reasoning depth.

SECTION 11 — Modify Flow Preservation

Modify must:

Preserve domain context.

Update only relevant sections.

Maintain ID stability.

Avoid reintroducing template bias.

SECTION 12 — Evaluation Criteria for V2

System must pass these tests:

Test 1

Prompt:

inventory dashboard


Output must NOT include:

CTR

CPC

Conversion Rate

Active Users

Test 2

Prompt:

marketing performance dashboard


Must include marketing metrics.

Test 3

Prompt:

financial summary report


Must include:

Revenue

Expenses

Profit

SECTION 13 — Implementation Requirements

Coding LLM must:

Create Domain Extractor module.

Integrate domain output into Planner.

Update Planner prompt template.

Implement domain-specific metric mapping logic.

Add anti-template safeguard.

Update Explainer template.

Maintain AST validation and safety constraints.

SECTION 14 — Non-Negotiables

Do NOT:

Remove deterministic constraints.

Remove validation.

Remove multi-agent separation.

Remove component whitelist.

Enhance intelligence within constraints.

FINAL INSTRUCTION TO CODING LLM

Upgrade the system to V2 by:

Introducing domain-aware reasoning.

Eliminating marketing bias fallback.

Generating domain-specific metrics.

Structuring layout based on operational context.

Improving explanation clarity.

Maintaining deterministic safety guarantees.

The goal is to make the system unmistakably AI-driven and context-aware.OpenAI error (429): {"error":{"message":"Rate limit reached for model `llama-3.1-8b-instant` in organization `org_01khbkr6czfnj9jjd400n0af4g` service tier `on_demand` on tokens per minute (TPM): Limit 6000, Used 4573, Requested 1636. Please try again in 2.089999999s. Need more tokens? Upgrade to Dev Tier today at https://console.groq.com/settings/billing","type":"tokens","code":"rate_limit_exceeded"}}