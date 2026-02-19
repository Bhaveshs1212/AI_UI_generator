import type { Plan, PlanComponent } from "../../types/plan";
import { buildGeneratorPrompt, stripCodeFences } from "./prompts";
import type { AgentClient } from "./planner";
import {
	ALLOWED_COMPONENTS,
	COMPONENT_PROP_SCHEMA,
	type AllowedComponent,
} from "../validation/componentWhitelist";

export interface GeneratorResult {
	code: string;
	raw: string;
}

export class GeneratorError extends Error {
	code: "empty_output";

	constructor(message: string) {
		super(message);
		this.code = "empty_output";
	}
}

export async function runGenerator(
	client: AgentClient,
	plan: Plan
): Promise<GeneratorResult> {
	const prompt = buildGeneratorPrompt(plan);
	const raw = await client.complete(prompt);
	const code = stripCodeFences(raw);

	if (!code) {
		throw new GeneratorError("Generator returned empty JSX.");
	}

	return { code, raw };
}

function toStringLiteral(value: string): string {
	return JSON.stringify(value);
}

function toJsxExpression(value: unknown): string {
	if (typeof value === "string") {
		return toStringLiteral(value);
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return `{${String(value)}}`;
	}

	return `{${JSON.stringify(value)}}`;
}

function ensurePropValue(component: AllowedComponent, propName: string, rawValue: unknown) {
	const schema = COMPONENT_PROP_SCHEMA[component][propName];
	if (!schema) {
		return undefined;
	}

	if (schema.type === "string") {
		return typeof rawValue === "string" ? rawValue : undefined;
	}

	if (schema.type === "number") {
		return typeof rawValue === "number" ? rawValue : undefined;
	}

	if (schema.type === "boolean") {
		return typeof rawValue === "boolean" ? rawValue : undefined;
	}

	if (schema.type === "string[]") {
		return Array.isArray(rawValue) && rawValue.every((value) => typeof value === "string")
			? rawValue
			: undefined;
	}

	if (schema.type === "number[]") {
		return Array.isArray(rawValue) && rawValue.every((value) => typeof value === "number")
			? rawValue
			: undefined;
	}

	if (schema.type === "string[][]") {
		return Array.isArray(rawValue) && rawValue.every(
			(value) => Array.isArray(value) && value.every((cell) => typeof cell === "string")
		)
			? rawValue
			: undefined;
	}

	return undefined;
}

function getDefaultProps(component: AllowedComponent, id: string): Record<string, unknown> {
	switch (component) {
		case "Button":
			return { id, label: "Button", variant: "primary" };
		case "Card":
			return { id, title: "Card" };
		case "Input":
			return { id, label: "Input" };
		case "Table":
			return {
				id,
				columns: ["Column 1", "Column 2"],
				rows: [["Row 1", "Row 2"]],
			};
		case "Modal":
			return { id, title: "Modal", isOpen: true };
		case "Sidebar":
			return { id, items: ["Item 1", "Item 2"] };
		case "Navbar":
			return { id, title: "Navigation" };
		case "Chart":
			return { id, title: "Chart", data: [1, 2, 3] };
		default:
			return { id };
	}
}

function buildComponentJsx(component: AllowedComponent, id: string, props: Record<string, unknown>) {
	const defaults = getDefaultProps(component, id);
	const schema = COMPONENT_PROP_SCHEMA[component];
	const finalProps: Record<string, unknown> = { ...defaults };

	for (const [key, value] of Object.entries(props)) {
		if (!schema[key] || key === "children") {
			continue;
		}

		const ensured = ensurePropValue(component, key, value);
		if (ensured !== undefined) {
			finalProps[key] = ensured;
		}
	}

	const attrs = Object.entries(finalProps)
		.filter(([key]) => key !== "children")
		.map(([key, value]) => {
			if (typeof value === "string") {
				return `${key}=${toStringLiteral(value)}`;
			}

			return `${key}=${toJsxExpression(value)}`;
		});

	const content =
		component === "Card" || component === "Modal"
			? typeof props.content === "string"
				? props.content
				: typeof props.children === "string"
				? props.children
				: ""
			: "";

	if (content) {
		return `<${component} ${attrs.join(" ")}>${content}</${component}>`;
	}

	return `<${component} ${attrs.join(" ")} />`;
}

export function buildDeterministicJsx(plan: Plan): string {
	const allowedComponents = plan.components.filter((component) =>
		ALLOWED_COMPONENTS.includes(component.type)
	);
	const components = plan.layoutPlan?.sections?.length
		? (() => {
			const byId = new Map(allowedComponents.map((component) => [component.id, component]));
			const ordered: PlanComponent[] = [];
			for (const section of plan.layoutPlan.sections) {
				for (const componentId of section.components) {
					const match = byId.get(componentId);
					if (match) {
						ordered.push(match);
						byId.delete(componentId);
					}
				}
			}
			ordered.push(...byId.values());
			return ordered;
		})()
		: allowedComponents;

	const rendered = components.map((component) =>
		buildComponentJsx(
			component.type,
			component.id,
			(component.props ?? {}) as Record<string, unknown>
		)
	);

	if (rendered.length === 1) {
		return rendered[0];
	}

	return `<>\n${rendered.join("\n")}\n</>`;
}
