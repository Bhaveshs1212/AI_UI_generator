import type { ReasoningOutput } from "../../types/plan";
import { buildReasoningPrompt, stripCodeFences } from "./prompts";
import type { AgentClient } from "./planner";

export interface ReasoningResult {
	reasoning: ReasoningOutput;
	raw: string;
}

export class ReasoningError extends Error {
	code: "invalid_json" | "invalid_reasoning";

	constructor(message: string, code: "invalid_json" | "invalid_reasoning") {
		super(message);
		this.code = code;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
		: [];
}

function normalizeReasoning(value: unknown): ReasoningOutput | null {
	if (!isRecord(value)) {
		return null;
	}

	const domainModelValue = value.domainModel;
	if (!isRecord(domainModelValue)) {
		return null;
	}

	const productOrSystem =
		typeof domainModelValue.productOrSystem === "string"
			? domainModelValue.productOrSystem.trim()
			: "";
	const domainType =
		typeof domainModelValue.domainType === "string"
			? domainModelValue.domainType.trim()
			: "";
	const userRole =
		typeof domainModelValue.userRole === "string"
			? domainModelValue.userRole.trim()
			: "";
	const primaryGoal =
		typeof domainModelValue.primaryGoal === "string"
			? domainModelValue.primaryGoal.trim()
			: "";

	if (!productOrSystem || !domainType || !userRole || !primaryGoal) {
		return null;
	}

	const dataModelHintsValue = value.dataModelHints;
	if (!isRecord(dataModelHintsValue)) {
		return null;
	}

	const tablesNeeded = normalizeStringArray(dataModelHintsValue.tablesNeeded);
	const chartsNeeded = normalizeStringArray(dataModelHintsValue.chartsNeeded);
	const summaryMetricsNeeded = normalizeStringArray(
		dataModelHintsValue.summaryMetricsNeeded
	);

	return {
		domainModel: {
			productOrSystem,
			domainType,
			userRole,
			primaryGoal,
		},
		entities: normalizeStringArray(value.entities),
		insightsRequired: normalizeStringArray(value.insightsRequired),
		metricsToTrack: normalizeStringArray(value.metricsToTrack),
		dataModelHints: {
			tablesNeeded,
			chartsNeeded,
			summaryMetricsNeeded,
		},
	};
}

function parseReasoning(raw: string): ReasoningOutput {
	let parsed: unknown;
	try {
		parsed = JSON.parse(stripCodeFences(raw));
	} catch (error) {
		throw new ReasoningError("Reasoning returned invalid JSON.", "invalid_json");
	}

	const normalized = normalizeReasoning(parsed);
	if (!normalized) {
		throw new ReasoningError("Reasoning returned invalid schema.", "invalid_reasoning");
	}

	return normalized;
}

export async function runReasoning(
	client: AgentClient,
	userMessage: string,
	previousReasoning?: ReasoningOutput | null
): Promise<ReasoningResult> {
	const prompt = buildReasoningPrompt(userMessage, previousReasoning ?? null);
	const raw = await client.complete(prompt);
	const reasoning = parseReasoning(raw);

	return { reasoning, raw };
}
