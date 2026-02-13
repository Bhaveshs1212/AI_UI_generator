import type { Plan } from "../../types/plan";
import { buildExplainerPrompt, stripCodeFences } from "./prompts";
import type { AgentClient } from "./planner";

export interface ExplainerResult {
	explanation: string;
	raw: string;
}

export class ExplainerError extends Error {
	code: "empty_output";

	constructor(message: string) {
		super(message);
		this.code = "empty_output";
	}
}

export async function runExplainer(
	client: AgentClient,
	plan: Plan,
	code: string
): Promise<ExplainerResult> {
	const prompt = buildExplainerPrompt(plan, code);
	const raw = await client.complete(prompt);
	const explanation = stripCodeFences(raw);

	if (!explanation) {
		throw new ExplainerError("Explainer returned empty text.");
	}

	return { explanation, raw };
}
