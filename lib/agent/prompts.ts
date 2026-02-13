import type { Plan } from "../../types/plan";
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
- Use only allowed components:
	${COMPONENT_LIST}.
- Use only the allowed props for each component:
${COMPONENT_SCHEMA}
- Do not invent props (e.g., use Card.title, not Card.header).

You must return a single JSON object with this exact shape:
{
	"type": "new" | "modify" | "regenerate",
	"layout": "<layout-name>",
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

Interpret the user's request and generate a structured UI plan.`;

export const GENERATOR_PROMPT = `You are a deterministic UI code generator.

Rules:
- Use only allowed components.
- Do not create new components.
- Do not use inline styles.
- Do not use external UI libraries.
- Preserve existing components if modifying.
- Output valid React JSX only.
- Return a single JSX element or fragment that starts with < (no markdown fences, no commentary).`;

export const EXPLAINER_PROMPT = `You are a UI explanation agent.

Explain:
- Why layout was chosen
- Why components were selected
- What was modified (if applicable)

Return clear plain English explanation.`;

export function buildPlannerPrompt(userMessage: string, previousPlan?: Plan | null) {
	const previous = previousPlan ? JSON.stringify(previousPlan, null, 2) : "null";

	return `${PLANNER_PROMPT}

User message:
${userMessage}

Previous plan:
${previous}

Return JSON only.`;
}

export function buildGeneratorPrompt(plan: Plan): string {
	return `${GENERATOR_PROMPT}

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
