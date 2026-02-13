import { NextResponse } from "next/server";
import type { Plan } from "../../../types/plan";
import { applyPlanChanges, runPlanner, PlannerError } from "../../../lib/agent/planner";
import { buildDeterministicJsx, runGenerator } from "../../../lib/agent/generator";
import { runExplainer } from "../../../lib/agent/explainer";
import { validateJsx } from "../../../lib/validation/jsxValidator";
import { addVersion, getCurrentVersionIndex } from "../../../lib/version/versionManager";
import { getChangedComponentIds } from "../../../lib/version/diff";
import { createOpenAIClient } from "../../../lib/agent/client";
import { validatePromptSafety } from "../../../lib/validation/promptValidator";

interface ModifyRequest {
	userMessage: string;
	sessionId: string;
	currentVersion: {
		id: string;
		plan: Plan;
		code: string;
	};
}

export interface ModifyResponse {
	success: boolean;
	version?: {
		id: string;
		index: number;
		timestamp: number;
	};
	plan?: Plan;
	code?: string;
	explanation?: string;
	validation?: {
		componentCheck: boolean;
		propCheck: boolean;
	};
	diff?: {
		changedComponents: string[];
	};
	error?: string;
}

function getAgentClient() {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("Missing OPENAI_API_KEY.");
	}

	const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
	const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

	return createOpenAIClient({ apiKey, baseUrl, model });
}

export async function POST(request: Request) {
	let payload: ModifyRequest;
	try {
		payload = (await request.json()) as ModifyRequest;
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON payload." } satisfies ModifyResponse,
			{ status: 400 }
		);
	}

	if (!payload.userMessage || !payload.currentVersion) {
		return NextResponse.json(
			{ success: false, error: "Missing userMessage or currentVersion." } satisfies ModifyResponse,
			{ status: 400 }
		);
	}

	const maxPromptLength = 2000;
	if (payload.userMessage.length > maxPromptLength) {
		return NextResponse.json(
			{ success: false, error: "Prompt too long." } satisfies ModifyResponse,
			{ status: 400 }
		);
	}

	const promptCheck = validatePromptSafety(payload.userMessage);
	if (!promptCheck.isValid) {
		return NextResponse.json(
			{ success: false, error: promptCheck.error ?? "Unsafe prompt." } satisfies ModifyResponse,
			{ status: 400 }
		);
	}

	const client = getAgentClient();

	try {
		const plannerResult = await runPlanner(client, {
			userMessage: payload.userMessage,
			previousPlan: payload.currentVersion.plan,
		});
		const plannerPlan =
			plannerResult.plan.type === "modify"
				? plannerResult.plan
				: {
					...plannerResult.plan,
					type: "modify" as const,
					components: payload.currentVersion.plan.components,
					changes: plannerResult.plan.changes ?? [],
				};

		const resolvedPlan = applyPlanChanges(payload.currentVersion.plan, plannerPlan);

		let generatorResult = await runGenerator(client, resolvedPlan);
		let validation = validateJsx(generatorResult.code);
		if (!validation.isValid && validation.errors.includes("Invalid JSX: unable to parse")) {
			generatorResult = await runGenerator(client, resolvedPlan);
			validation = validateJsx(generatorResult.code);
		}
		if (!validation.isValid) {
			const fallbackCode = buildDeterministicJsx(resolvedPlan);
			const fallbackValidation = validateJsx(fallbackCode);
			if (fallbackValidation.isValid) {
				generatorResult = { code: fallbackCode, raw: "fallback" };
				validation = fallbackValidation;
			} else {
				const debug =
					process.env.NODE_ENV === "development"
						? { generatedCode: generatorResult.code, rawOutput: generatorResult.raw }
						: undefined;
				return NextResponse.json(
					{
						success: false,
						error: validation.errors.join(" "),
						validation: {
							componentCheck: validation.componentCheck,
							propCheck: validation.propCheck,
						},
						...(debug ? { debug } : {}),
					} satisfies ModifyResponse,
					{ status: 400 }
				);
			}
		}

		const explainerResult = await runExplainer(
			client,
			resolvedPlan,
			generatorResult.code
		);

		const version = addVersion({
			plan: resolvedPlan,
			code: generatorResult.code,
			explanation: explainerResult.explanation,
		});

		const previousPlan = payload.currentVersion.plan;
		const changedComponents = getChangedComponentIds(previousPlan, resolvedPlan);

		return NextResponse.json(
			{
				success: true,
				version: {
					id: version.id,
					index: getCurrentVersionIndex(),
					timestamp: version.timestamp,
				},
				plan: resolvedPlan,
				code: generatorResult.code,
				explanation: explainerResult.explanation,
				validation: {
					componentCheck: validation.componentCheck,
					propCheck: validation.propCheck,
				},
				diff: {
					changedComponents,
				},
			} satisfies ModifyResponse,
			{ status: 200 }
		);
	} catch (error) {
		const message =
			error instanceof PlannerError
				? error.message
				: error instanceof Error
				? error.message
				: "Unknown error";

		const status = error instanceof PlannerError ? 400 : 500;
		return NextResponse.json(
			{ success: false, error: message } satisfies ModifyResponse,
			{ status }
		);
	}
}
