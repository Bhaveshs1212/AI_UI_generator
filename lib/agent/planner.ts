import type { Plan, PlanChange, PlanComponent, PlanType } from "../../types/plan";
import { buildPlannerPrompt, stripCodeFences } from "./prompts";
import {
	ALLOWED_COMPONENTS,
	COMPONENT_PROP_SCHEMA,
	type PropSchema,
} from "../validation/componentWhitelist";

export interface AgentClient {
	complete(prompt: string): Promise<string>;
}

export interface PlannerRequest {
	userMessage: string;
	previousPlan?: Plan | null;
}

export interface PlannerResult {
	plan: Plan;
	raw: string;
}

export class PlannerError extends Error {
	code: "invalid_json" | "invalid_plan";

	constructor(message: string, code: "invalid_json" | "invalid_plan") {
		super(message);
		this.code = code;
	}
}

function buildDefaultProps(componentType: PlanComponent["type"], id: string): Record<string, unknown> {
	switch (componentType) {
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
			return { id, title: "Settings", isOpen: false };
		case "Sidebar":
			return { id, items: ["Item 1", "Item 2"] };
		case "Navbar":
			return { id, title: "My App" };
		case "Chart":
			return { id, title: "Chart", data: [1, 2, 3] };
		default:
			return { id };
	}
}

function buildHeuristicPlan(userMessage: string, previousPlan?: Plan | null): Plan {
	const message = userMessage.toLowerCase();
	const layout = message.includes("dashboard") ? "dashboard" : "basic";
	const type: PlanType = previousPlan ? "modify" : "new";

	const components: PlanComponent[] = [];
	const changes: PlanChange[] = [];

	const idFor = (base: string, existing: Set<string>) => {
		let index = 1;
		let candidate = `${base}-${index}`;
		while (existing.has(candidate)) {
			index += 1;
			candidate = `${base}-${index}`;
		}
		return candidate;
	};

	const existingIds = new Set<string>(previousPlan?.components.map((c) => c.id) ?? []);

	if (!previousPlan) {
		const desired: Array<{ keyword: string; type: PlanComponent["type"]; base: string }> = [
			{ keyword: "navbar", type: "Navbar", base: "navbar" },
			{ keyword: "card", type: "Card", base: "card" },
			{ keyword: "chart", type: "Chart", base: "chart" },
			{ keyword: "table", type: "Table", base: "table" },
			{ keyword: "sidebar", type: "Sidebar", base: "sidebar" },
			{ keyword: "modal", type: "Modal", base: "modal" },
			{ keyword: "button", type: "Button", base: "button" },
			{ keyword: "input", type: "Input", base: "input" },
		];

		for (const item of desired) {
			if (!message.includes(item.keyword)) {
				continue;
			}

			const id = idFor(item.base, existingIds);
			existingIds.add(id);
			components.push({
				id,
				type: item.type,
				props: buildDefaultProps(item.type, id),
			});
		}

		if (components.length === 0) {
			const id = idFor("card", existingIds);
			components.push({
				id,
				type: "Card",
				props: buildDefaultProps("Card", id),
			});
		}
	} else {
		components.push(...previousPlan.components.map((component) => ({
			...component,
			props: { ...component.props },
		})));

		if (message.includes("add") && message.includes("modal")) {
			const id = idFor("modal", existingIds);
			changes.push({
				id,
				type: "add",
				componentType: "Modal",
				props: buildDefaultProps("Modal", id),
			});
		}

		if (message.includes("remove") && message.includes("chart")) {
			const chartId =
				previousPlan.components.find((component) => component.type === "Chart")?.id ??
				idFor("chart", existingIds);
			changes.push({ id: chartId, type: "remove", componentType: "Chart" });
		}

		if ((message.includes("change") || message.includes("update")) && message.includes("card")) {
			const cardId =
				previousPlan.components.find((component) => component.type === "Card")?.id ??
				idFor("card", existingIds);
			const title = message.includes("income") ? "Income" : "Updated";
			changes.push({
				id: cardId,
				type: "update",
				componentType: "Card",
				props: { title },
			});
		}
	}

	return {
		type,
		layout,
		components,
		changes,
	};
}

function isPlanShape(value: unknown): value is Plan {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Plan;
	return (
		typeof candidate.type === "string" &&
		typeof candidate.layout === "string" &&
		Array.isArray(candidate.components) &&
		Array.isArray(candidate.changes)
	);
}

function normalizePlan(value: unknown): Plan | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Partial<Plan>;
	if (typeof candidate.type !== "string" || typeof candidate.layout !== "string") {
		return null;
	}

	const normalizeProps = (
		componentType: PlanComponent["type"],
		props: unknown
	): Record<string, unknown> => {
		if (!isRecord(props)) {
			return {};
		}

		const normalized = { ...props } as Record<string, unknown>;
		if (componentType === "Card" || componentType === "Navbar" || componentType === "Modal") {
			if (typeof normalized.header === "string" && typeof normalized.title !== "string") {
				normalized.title = normalized.header;
			}
			delete normalized.header;
		}

		if (componentType === "Button") {
			if (typeof normalized.text === "string" && typeof normalized.label !== "string") {
				normalized.label = normalized.text;
			}
			delete normalized.text;
		}

		if (componentType === "Table") {
			if (Array.isArray(normalized.headers) && !normalized.columns) {
				normalized.columns = normalized.headers;
			}
			delete normalized.headers;
		}

		if (componentType === "Chart") {
			if (Array.isArray(normalized.values) && !normalized.data) {
				normalized.data = normalized.values;
			}
			delete normalized.values;
		}

		const allowedProps = COMPONENT_PROP_SCHEMA[componentType];
		for (const key of Object.keys(normalized)) {
			if (!allowedProps[key]) {
				delete normalized[key];
			}
		}

		return normalized;
	};

	const components = Array.isArray(candidate.components)
		? candidate.components
				.map((component) => {
					if (!component || typeof component !== "object") {
						return null;
					}

					const item = component as PlanComponent;
					const normalizedType = normalizeComponentType(item.type);
					if (typeof item.id !== "string" || !normalizedType) {
						return null;
					}

					return {
						id: item.id,
						type: normalizedType,
						props: normalizeProps(normalizedType, item.props),
					} satisfies PlanComponent;
				})
				.filter((component): component is PlanComponent => component !== null)
		: [];

	const changes = Array.isArray(candidate.changes)
		? candidate.changes
				.map((change) => {
					if (!change || typeof change !== "object") {
						return null;
					}

					const item = change as PlanChange;
					const componentType = normalizeComponentType(item.componentType) ?? undefined;
					return {
						id: item.id ?? "",
						type: item.type as PlanChange["type"],
						componentType,
						props: componentType ? normalizeProps(componentType, item.props) : item.props,
					} satisfies PlanChange;
				})
				.filter((change): change is PlanChange => change !== null)
		: [];

	return {
		type: candidate.type,
		layout: candidate.layout,
		components,
		changes,
	};
}

function isValidPlanType(value: string): value is PlanType {
	return value === "new" || value === "modify" || value === "regenerate";
}

function normalizeComponentType(rawType: unknown): PlanComponent["type"] | null {
	if (typeof rawType !== "string") {
		return null;
	}

	const match = ALLOWED_COMPONENTS.find(
		(component) => component.toLowerCase() === rawType.toLowerCase()
	);

	return match ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isValidPropValue(schema: PropSchema, value: unknown): boolean {
	if (schema.type === "string") {
		return typeof value === "string";
	}

	if (schema.type === "number") {
		return typeof value === "number";
	}

	if (schema.type === "boolean") {
		return typeof value === "boolean";
	}

	if (schema.type === "string[]") {
		return Array.isArray(value) && value.every((entry) => typeof entry === "string");
	}

	if (schema.type === "number[]") {
		return Array.isArray(value) && value.every((entry) => typeof entry === "number");
	}

	if (schema.type === "string[][]") {
		return (
			Array.isArray(value) &&
			value.every(
				(entry) => Array.isArray(entry) && entry.every((cell) => typeof cell === "string")
			)
		);
	}

	if (schema.type === "node") {
		return typeof value === "string";
	}

	return false;
}

function validateProps(
	componentType: PlanComponent["type"],
	props: Record<string, unknown>,
	allowPartial: boolean
): boolean {
	const schema = COMPONENT_PROP_SCHEMA[componentType];

	for (const [key, value] of Object.entries(props)) {
		const propSchema = schema[key];
		if (!propSchema) {
			return false;
		}

		if (!isValidPropValue(propSchema, value)) {
			return false;
		}

		if (propSchema.allowedValues) {
			if (!propSchema.allowedValues.includes(String(value))) {
				return false;
			}
		}
	}

	if (!allowPartial) {
		for (const [propName, propSchema] of Object.entries(schema)) {
			if (propSchema.required && !(propName in props)) {
				return false;
			}
		}
	}

	return true;
}

function isValidComponent(component: PlanComponent): boolean {
	if (!ALLOWED_COMPONENTS.includes(component.type)) {
		return false;
	}

	if (!isRecord(component.props)) {
		return false;
	}

	return validateProps(component.type, component.props, true);
}

function isValidChange(change: PlanChange): boolean {
	if (change.type !== "add" && change.type !== "update" && change.type !== "remove") {
		return false;
	}

	if (change.componentType && !ALLOWED_COMPONENTS.includes(change.componentType)) {
		return false;
	}

	if (change.type === "remove") {
		return true;
	}

	if (!change.componentType) {
		return false;
	}

	const props = change.props ?? {};
	if (!isRecord(props)) {
		return false;
	}

	return validateProps(change.componentType, props, change.type === "update");

}

function validatePlan(plan: Plan): boolean {
	if (!isValidPlanType(plan.type)) {
		return false;
	}

	if (!plan.components.every(isValidComponent)) {
		return false;
	}

	if (!plan.changes.every(isValidChange)) {
		return false;
	}

	return true;
}

function parsePlan(raw: string): Plan {
	let parsed: unknown;
	try {
		parsed = JSON.parse(stripCodeFences(raw));
	} catch (error) {
		throw new PlannerError("Planner returned invalid JSON.", "invalid_json");
	}

	const normalized = normalizePlan(parsed);
	if (normalized) {
		if (!validatePlan(normalized)) {
			throw new PlannerError("Planner returned an invalid plan shape.", "invalid_plan");
		}
		return normalized;
	}

	if (!isPlanShape(parsed)) {
		throw new PlannerError("Planner returned an invalid plan shape.", "invalid_plan");
	}

	return parsed;
}

export function applyPlanChanges(previousPlan: Plan, plan: Plan): Plan {
	if (plan.type !== "modify") {
		return plan;
	}

	const existingIds = new Set(previousPlan.components.map((component) => component.id));
	const existingByType = new Map<PlanComponent["type"], PlanComponent[]>();
	for (const component of previousPlan.components) {
		const list = existingByType.get(component.type) ?? [];
		list.push(component);
		existingByType.set(component.type, list);
	}

	const buildUniqueId = (base: string) => {
		let index = 1;
		let candidate = `${base}-${index}`;
		while (existingIds.has(candidate)) {
			index += 1;
			candidate = `${base}-${index}`;
		}
		return candidate;
	};

	const resolveChangeId = (change: PlanChange): string | null => {
		if (typeof change.id === "string" && change.id.trim().length > 0) {
			if (change.type === "add") {
				if (!existingIds.has(change.id)) {
					return change.id;
				}
			} else if (existingIds.has(change.id)) {
				return change.id;
			}
		}

		if (change.componentType) {
			const matches = existingByType.get(change.componentType) ?? [];
			if (change.type !== "add" && matches.length === 1) {
				return matches[0].id;
			}

			if (change.type === "add") {
				const base = change.componentType.toLowerCase();
				return buildUniqueId(base);
			}
		}

		return null;
	};

	const nextComponents = new Map<string, PlanComponent>();
	for (const component of previousPlan.components) {
		nextComponents.set(component.id, {
			...component,
			props: { ...component.props },
		});
	}

	for (const change of plan.changes) {
		const resolvedId = resolveChangeId(change);
		if (!resolvedId) {
			continue;
		}

		if (change.type === "remove") {
			nextComponents.delete(resolvedId);
			continue;
		}

		if (!change.componentType) {
			continue;
		}

		if (change.type === "add") {
			nextComponents.set(resolvedId, {
				id: resolvedId,
				type: change.componentType,
				props: { ...(change.props ?? {}) },
			});
			existingIds.add(resolvedId);
			continue;
		}

		const existing = nextComponents.get(resolvedId);
		if (existing) {
			nextComponents.set(resolvedId, {
				...existing,
				props: { ...existing.props, ...(change.props ?? {}) },
			});
		} else {
			nextComponents.set(resolvedId, {
				id: resolvedId,
				type: change.componentType,
				props: { ...(change.props ?? {}) },
			});
		}
	}

	return {
		...plan,
		components: Array.from(nextComponents.values()),
	};
}

export function materializePlan(plan: Plan): Plan {
	const nextComponents = new Map<string, PlanComponent>();
	for (const component of plan.components) {
		nextComponents.set(component.id, {
			...component,
			props: { ...component.props },
		});
	}

	for (const change of plan.changes) {
		if (change.type === "remove") {
			nextComponents.delete(change.id);
			continue;
		}

		if (!change.componentType) {
			continue;
		}

		if (change.type === "add") {
			nextComponents.set(change.id, {
				id: change.id,
				type: change.componentType,
				props: { ...(change.props ?? {}) },
			});
			continue;
		}

		const existing = nextComponents.get(change.id);
		if (existing) {
			nextComponents.set(change.id, {
				...existing,
				props: { ...existing.props, ...(change.props ?? {}) },
			});
		} else {
			nextComponents.set(change.id, {
				id: change.id,
				type: change.componentType,
				props: { ...(change.props ?? {}) },
			});
		}
	}

	return {
		...plan,
		components: Array.from(nextComponents.values()),
	};
}

export async function runPlanner(
	client: AgentClient,
	request: PlannerRequest
): Promise<PlannerResult> {
	const prompt = buildPlannerPrompt(request.userMessage, request.previousPlan);

	let raw = await client.complete(prompt);
	try {
		return { plan: parsePlan(raw), raw };
	} catch (error) {
		if (error instanceof PlannerError) {
			if (error.code === "invalid_json" || error.code === "invalid_plan") {
				raw = await client.complete(prompt);
				try {
					return { plan: parsePlan(raw), raw };
				} catch (retryError) {
					if (retryError instanceof PlannerError && retryError.code === "invalid_plan") {
						return {
							plan: buildHeuristicPlan(request.userMessage, request.previousPlan ?? null),
							raw,
						};
					}

					throw retryError;
				}
			}
		}

		throw error;
	}
}
