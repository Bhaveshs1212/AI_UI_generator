import type { Plan, ReasoningOutput } from "../../types/plan";
import {
	ALLOWED_COMPONENTS,
	COMPONENT_PROP_SCHEMA,
} from "../validation/componentWhitelist";

const COMPONENT_LIST = ALLOWED_COMPONENTS.join(", ");

const COMPONENT_SCHEMA = ALLOWED_COMPONENTS.map((component) => {
	const schema = COMPONENT_PROP_SCHEMA[component];
	const props = Object.entries(schema)
		.map(([propName, propSchema]) => {
			const required = propSchema.required ? "required" : "optional";
			const allowedValues = propSchema.allowedValues
				? ` allowed: ${propSchema.allowedValues.join("|")}`
				: "";
			return `${propName}: ${propSchema.type} (${required})${allowedValues}`;
		})
		.join(", ");
	return `${component}: ${props}`;
}).join("\n");

export const PLANNER_PROMPT = `You are a UI planning agent.

Rules:
- Output STRICT JSON only.
- Do not generate code.
- Do not re-do reasoning. Use the provided reasoning JSON as the sole source of domain intelligence.
- Use only allowed components:
	${COMPONENT_LIST}.
- Use only the allowed props for each component:
${COMPONENT_SCHEMA}
- Do not invent props (e.g., use Card.title, not Card.header).
- If intentType is "marketing_page" or "marketing", create a multi-section informational layout using the allowed components (Cards, Navbar, Sidebar, Button, Input). Include at least 4 components across multiple sections.
- Do not include Chart or Table unless the user explicitly asks for analytics, charts, or tables.

You must return a single JSON object with this exact shape:
{
	"type": "new" | "modify" | "regenerate",
	"layout": "<layout-name>",
	"domainAnalysis": {
		"domain": "<string>",
		"keyEntities": ["<string>"],
		"inferredIndustry": "<string>",
		"operationalConcepts": ["<string>"]
	},
	"intentAnalysis": {
		"intentType": "report" | "dashboard" | "form" | "marketing" | "marketing_page" | "crud",
		"domain": "<string>",
		"complexity": "simple" | "moderate" | "complex",
		"layoutStrategy": "<string>"
	},
	"layoutPlan": {
		"sections": [
			{
				"id": "<string>",
				"type": "metrics" | "table" | "chart" | "mixed",
				"title": "<string>",
				"purpose": "<string>",
				"components": ["<component-id>"]
			}
		]
	},
	"dataModel": {
		"metrics": [
			{ "label": "<string>", "value": "<string>" }
		],
		"tables": [
			{
				"id": "<string>",
				"columns": ["<string>"],
				"rows": [ { "<column>": "<string or number>" } ]
			}
		],
		"charts": [
			{
				"id": "<string>",
				"type": "line" | "bar",
				"labels": ["<string>"],
				"values": [0]
			}
		]
	},
	"components": [
		{
			"id": "<string>",
			"type": "<AllowedComponent>",
			"props": { "<prop>": "<value>" }
		}
	],
	"changes": [
		{
			"id": "<string>",
			"type": "add" | "update" | "remove",
			"componentType": "<AllowedComponent>",
			"props": { "<prop>": "<value>" }
		}
	]
}

Return JSON only. No markdown, no commentary.

Use the reasoning JSON to generate a structured UI plan.
If the intentType implies data (report or dashboard), populate dataModel with realistic mock data and reference it in components.
Anti-template rule: metrics and data must match the reasoning output. Do not introduce unrelated or generic metrics.`;

export const REASONING_PROMPT = `You are a reasoning agent.

Rules:
- Output STRICT JSON only.
- Do not generate code.
- Do not generate layout or components.
- Identify domain, user role, and primary goal.
- Identify realistic entities, insights, and metrics.

You must return a single JSON object with this exact shape:
{
	"domainModel": {
		"productOrSystem": "<string>",
		"domainType": "<string>",
		"userRole": "<string>",
		"primaryGoal": "<string>"
	},
	"entities": ["<string>"],
	"insightsRequired": ["<string>"],
	"metricsToTrack": ["<string>"],
	"dataModelHints": {
		"tablesNeeded": ["<string>"],
		"chartsNeeded": ["<string>"],
		"summaryMetricsNeeded": ["<string>"]
	}
}

Return JSON only. No markdown, no commentary.`;

export const GENERATOR_PROMPT = `You are a deterministic UI code generator.

Rules:
- Use only allowed components.
- Do not create new components.
- Do not use inline styles.
- Do not use external UI libraries.
- Preserve existing components if modifying.
- Output valid React JSX only.
- Return a single JSX element or fragment that starts with < (no markdown fences, no commentary).`;

export const GENERATOR_INSTRUCTIONS = `Use layoutPlan and dataModel to build a structured layout. Avoid empty cards.
- Metrics become Card components with the metric value as children.
- Tables use columns and rows derived from dataModel.tables.
- Charts use title and numeric data from dataModel.charts.
- Preserve ids from the plan.`;

export const EXPLAINER_PROMPT = `You are a UI explanation agent.

Explain:
- Reasoning summary (domain, user role, primary goal)
- Intent analysis
- Layout strategy
- Data reasoning
- Why layout was chosen
- Why components were selected
- What was modified (if applicable)

Return clear plain English explanation.`;

export function buildPlannerPrompt(
	userMessage: string,
	previousPlan: Plan | null | undefined,
	reasoning: ReasoningOutput,
	extraInstructions?: string
) {
	const previous = previousPlan ? JSON.stringify(previousPlan, null, 2) : "null";
	const reasoningJson = JSON.stringify(reasoning, null, 2);
	const extra = extraInstructions?.trim() ? `\nAdditional constraints:\n${extraInstructions}` : "";

	return `${PLANNER_PROMPT}

User message:
${userMessage}

Reasoning JSON:
${reasoningJson}

${extra}

Previous plan:
${previous}

Return JSON only.`;
}

export function buildReasoningPrompt(
	userMessage: string,
	previousReasoning?: ReasoningOutput | null
): string {
	const previous = previousReasoning ? JSON.stringify(previousReasoning, null, 2) : "null";

	return `${REASONING_PROMPT}

User message:
${userMessage}

Previous reasoning:
${previous}

Return JSON only.`;
}

export function buildGeneratorPrompt(plan: Plan): string {
	return `${GENERATOR_PROMPT}

${GENERATOR_INSTRUCTIONS}

Plan:
${JSON.stringify(plan, null, 2)}

Return JSX only.`;
}

export function buildExplainerPrompt(plan: Plan, generatedCode: string): string {
	return `${EXPLAINER_PROMPT}

Plan:
${JSON.stringify(plan, null, 2)}

Generated Code:
${generatedCode}
`;
}

export function stripCodeFences(output: string): string {
	const trimmed = output.trim();
	return trimmed
		.replace(/^```[a-zA-Z]*\s*/u, "")
		.replace(/\s*```$/u, "")
		.trim();
}
