import { NextResponse } from "next/server";
import type { Plan } from "../../../types/plan";
import {
	materializePlan,
	runPlanner,
	PlannerError,
	isDataModelAlignedWithReasoning,
} from "../../../lib/agent/planner";
import { buildDeterministicJsx, runGenerator } from "../../../lib/agent/generator";
import { validateJsx } from "../../../lib/validation/jsxValidator";
import { addVersion, getCurrentVersionIndex } from "../../../lib/version/versionManager";
import { createOpenAIClient } from "../../../lib/agent/client";
import { validatePromptSafety } from "../../../lib/validation/promptValidator";
import { runReasoning } from "../../../lib/agent/reasoning";

interface GenerateRequest {
	userMessage: string;
	sessionId: string;
}

export interface GenerateResponse {
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
	let payload: GenerateRequest;
	try {
		payload = (await request.json()) as GenerateRequest;
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON payload." } satisfies GenerateResponse,
			{ status: 400 }
		);
	}

	if (!payload.userMessage) {
		return NextResponse.json(
			{ success: false, error: "Missing userMessage." } satisfies GenerateResponse,
			{ status: 400 }
		);
	}

	const maxPromptLength = 2000;
	if (payload.userMessage.length > maxPromptLength) {
		return NextResponse.json(
			{ success: false, error: "Prompt too long." } satisfies GenerateResponse,
			{ status: 400 }
		);
	}

	const promptCheck = validatePromptSafety(payload.userMessage);
	if (!promptCheck.isValid) {
		return NextResponse.json(
			{ success: false, error: promptCheck.error ?? "Unsafe prompt." } satisfies GenerateResponse,
			{ status: 400 }
		);
	}

	const client = getAgentClient();

	try {
		let reasoningResult = await runReasoning(client, payload.userMessage, null);
		let plannerResult = await runPlanner(client, {
			userMessage: payload.userMessage,
			reasoning: reasoningResult.reasoning,
		});

		if (
			plannerResult.plan.dataModel &&
			!isDataModelAlignedWithReasoning(
				reasoningResult.reasoning,
				plannerResult.plan.dataModel
			)
		) {
			reasoningResult = await runReasoning(
				client,
				payload.userMessage,
				reasoningResult.reasoning
			);
			plannerResult = await runPlanner(client, {
				userMessage: payload.userMessage,
				reasoning: reasoningResult.reasoning,
			});
		}

		const resolvedPlan = materializePlan(plannerResult.plan);

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
					} satisfies GenerateResponse,
					{ status: 400 }
				);
			}
		}

		const explanation = "";

		const version = addVersion({
			plan: resolvedPlan,
			code: generatorResult.code,
			explanation,
		});

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
				explanation,
				validation: {
					componentCheck: validation.componentCheck,
					propCheck: validation.propCheck,
				},
			} satisfies GenerateResponse,
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
			{ success: false, error: message } satisfies GenerateResponse,
			{ status }
		);
	}
}
