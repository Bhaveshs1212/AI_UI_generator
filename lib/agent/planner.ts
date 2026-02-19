import type {
	DataModel,
	DomainAnalysis,
	IntentAnalysis,
	IntentType,
	LayoutPlan,
	LayoutSectionType,
	Plan,
	PlanChange,
	PlanComponent,
	PlanType,
	ReasoningOutput,
} from "../../types/plan";
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
	reasoning?: ReasoningOutput | null;
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

function inferIntentAnalysis(userMessage: string): IntentAnalysis {
	const message = userMessage.toLowerCase();
	let intentType: IntentType = "dashboard";

	if (
		message.includes("home page") ||
		message.includes("homepage") ||
		message.includes("website") ||
		message.includes("landing page")
	) {
		intentType = "marketing_page";
	} else if (message.includes("report") || message.includes("ads") || message.includes("analytics")) {
		intentType = "report";
	} else if (message.includes("form") || message.includes("sign up") || message.includes("input")) {
		intentType = "form";
	} else if (message.includes("marketing") || message.includes("landing") || message.includes("hero")) {
		intentType = message.includes("page") ? "marketing_page" : "marketing";
	} else if (message.includes("crud") || message.includes("table") || message.includes("list")) {
		intentType = "crud";
	}

	let complexity: IntentAnalysis["complexity"] = "moderate";
	if (message.includes("simple") || message.includes("basic")) {
		complexity = "simple";
	} else if (message.includes("detailed") || message.includes("comprehensive")) {
		complexity = "complex";
	}

	const layoutStrategy =
		intentType === "report" || intentType === "dashboard"
			? "analytics_dashboard"
			: intentType === "form"
			? "input_form"
			: intentType === "marketing"
			? "hero_marketing"
			: intentType === "crud"
			? "data_management"
			: "basic";

	return {
		intentType,
		domain: "general",
		complexity,
		layoutStrategy,
	};
}

function buildDomainAnalysisFromReasoning(reasoning: ReasoningOutput): DomainAnalysis {
	const domainSource =
		reasoning.domainModel.domainType || reasoning.domainModel.productOrSystem || "general";
	const domain = slugify(domainSource) || "general";

	return {
		domain,
		keyEntities: [...reasoning.entities],
		inferredIndustry: reasoning.domainModel.domainType,
		operationalConcepts: [...reasoning.insightsRequired],
	};
}

function needsStructuredData(intentType: IntentType): boolean {
	return intentType === "report" || intentType === "dashboard";
}

function wantsDataComponents(userMessage: string): boolean {
	const message = userMessage.toLowerCase();
	return (
		message.includes("chart") ||
		message.includes("graph") ||
		message.includes("table") ||
		message.includes("report") ||
		message.includes("dashboard") ||
		message.includes("analytics")
	);
}

function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i += 1) {
		hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	}
	return hash;
}

function formatNumber(value: number): string {
	return value.toLocaleString("en-US");
}

function buildMetricValue(label: string): string {
	const lower = label.toLowerCase();
	const seed = hashString(lower);
	const base = (seed % 9000) + 100;

	if (/(rate|percent|%)/u.test(lower)) {
		const percent = ((seed % 450) + 50) / 10;
		return `${percent.toFixed(1)}%`;
	}

	if (/(revenue|expense|cost|profit|budget|price|amount|spend)/u.test(lower)) {
		const dollars = ((seed % 900) + 100) * 1000;
		return `$${formatNumber(dollars)}`;
	}

	if (/(time|duration|watch|hours)/u.test(lower)) {
		const hours = ((seed % 120) + 10).toFixed(0);
		return `${hours} hrs`;
	}

	return formatNumber(base);
}

function buildTableFromName(
	name: string,
	index: number,
	metrics: string[]
): DataModel["tables"][number] {
	const base = name.trim() || `table-${index + 1}`;
	const label = base.replace(/\s+/gu, " ").trim();
	const id = `table-${slugify(label) || `set-${index + 1}`}`;
	const columns = [`${label} Item`, "Metric", "Value"];
	const rows = ["A", "B", "C"].map((suffix, rowIndex) => {
		const metric = metrics[rowIndex % Math.max(metrics.length, 1)] ?? "Metric";
		return {
			[columns[0]]: `${label} ${suffix}`,
			Metric: metric,
			Value: buildMetricValue(metric),
		};
	});

	return { id, columns, rows };
}

function buildChartFromName(
	name: string,
	index: number
): DataModel["charts"][number] {
	const base = name.trim() || `chart-${index + 1}`;
	const label = base.replace(/\s+/gu, " ").trim();
	const id = `chart-${slugify(label) || `trend-${index + 1}`}`;
	const labels = ["Period 1", "Period 2", "Period 3", "Period 4"];
	const values = labels.map((entry) => (hashString(`${label}-${entry}`) % 80) + 20);

	return { id, type: "line", labels, values };
}

function synthesizeDataModel(reasoning: ReasoningOutput): DataModel {
	const metricsSeed = [
		...reasoning.metricsToTrack,
		...reasoning.dataModelHints.summaryMetricsNeeded,
	];
	const uniqueMetrics = Array.from(new Set(metricsSeed.map((metric) => metric.trim()))).filter(
		(metric) => metric.length > 0
	);
	const metrics = uniqueMetrics.length
		? uniqueMetrics.map((metric) => ({ label: metric, value: buildMetricValue(metric) }))
		: [
			{ label: "Key Metric", value: buildMetricValue("Key Metric") },
			{ label: "Primary Indicator", value: buildMetricValue("Primary Indicator") },
			{ label: "Operational Signal", value: buildMetricValue("Operational Signal") },
		];

	const tables = reasoning.dataModelHints.tablesNeeded.map((table, index) =>
		buildTableFromName(table, index, uniqueMetrics)
	);
	const charts = reasoning.dataModelHints.chartsNeeded.map((chart, index) =>
		buildChartFromName(chart, index)
	);

	return { metrics, tables, charts };
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-+|-+$/gu, "")
		.slice(0, 30) || "item";
}

function buildFallbackReasoning(userMessage: string): ReasoningOutput {
	const summary = userMessage
		.split(/\s+/gu)
		.slice(0, 6)
		.join(" ")
		.trim();

	return {
		domainModel: {
			productOrSystem: summary || "Requested UI",
			domainType: "general",
			userRole: "user",
			primaryGoal: "complete the requested task",
		},
		entities: [],
		insightsRequired: [],
		metricsToTrack: [],
		dataModelHints: {
			tablesNeeded: [],
			chartsNeeded: [],
			summaryMetricsNeeded: [],
		},
	};
}

function buildTableRows(table: DataModel["tables"][number]): string[][] {
	return table.rows.map((row) => table.columns.map((column) => String(row[column] ?? "")));
}

function buildComponentsFromDataModel(
	dataModel: DataModel,
	domainAnalysis: DomainAnalysis,
	reasoning: ReasoningOutput,
	seedIds?: Set<string>
): PlanComponent[] {
	const existingIds = seedIds ?? new Set<string>();
	const components: PlanComponent[] = [];

	const ensureUniqueId = (base: string) => {
		let index = 1;
		let candidate = base;
		if (existingIds.has(candidate)) {
			candidate = `${base}-${index}`;
			while (existingIds.has(candidate)) {
				index += 1;
				candidate = `${base}-${index}`;
			}
		}
		existingIds.add(candidate);
		return candidate;
	};

	for (const metric of dataModel.metrics) {
		const id = ensureUniqueId(`metric-${slugify(metric.label)}`);
		components.push({
			id,
			type: "Card",
			props: { id, title: metric.label, children: metric.value },
		});
	}

	for (const table of dataModel.tables) {
		const id = ensureUniqueId(table.id || `table-${slugify(domainAnalysis.domain)}`);
		components.push({
			id,
			type: "Table",
			props: { id, columns: table.columns, rows: buildTableRows(table) },
		});
	}

	for (const chart of dataModel.charts) {
		const id = ensureUniqueId(chart.id || `chart-${slugify(domainAnalysis.domain)}`);
		components.push({
			id,
			type: "Chart",
			props: {
				id,
				title: `${
				reasoning.domainModel.productOrSystem || reasoning.domainModel.domainType
			} trend`.trim(),
				data: chart.values,
			},
		});
	}

	if (components.length === 0) {
		const id = ensureUniqueId("card-1");
		components.push({
			id,
			type: "Card",
			props: { id, title: "Overview", children: "No data available" },
		});
	}

	return components;
}

function buildLayoutPlan(
	components: PlanComponent[],
	dataModel: DataModel
): LayoutPlan {
	const sections: LayoutPlan["sections"] = [];

	const metricIds = components
		.filter((component) => component.type === "Card")
		.map((component) => component.id);
	if (metricIds.length > 0) {
		sections.push({
			id: "summary-section",
			type: "metrics",
			title: "Summary Metrics",
			purpose: "High-level KPIs for quick health check",
			components: metricIds,
		});
	}

	const tableIds = components
		.filter((component) => component.type === "Table")
		.map((component) => component.id);
	if (tableIds.length > 0) {
		sections.push({
			id: "table-section",
			type: "table",
			title: "Detailed Table",
			purpose: "Operational detail and breakdown",
			components: tableIds,
		});
	}

	const chartIds = components
		.filter((component) => component.type === "Chart")
		.map((component) => component.id);
	if (chartIds.length > 0) {
		sections.push({
			id: "chart-section",
			type: "chart",
			title: "Trend Analysis",
			purpose: "Visual trend over time",
			components: chartIds,
		});
	}

	if (sections.length === 0 && dataModel.metrics.length === 0) {
		sections.push({
			id: "content-section",
			type: "mixed",
			title: "Content",
			purpose: "General layout grouping",
			components: components.map((component) => component.id),
		});
	}

	return { sections };
}

function isPlaceholderCard(component: PlanComponent): boolean {
	if (component.type !== "Card") {
		return false;
	}

	const title = component.props.title;
	const children = component.props.children ?? component.props.content;
	return (
		typeof title !== "string" ||
		title.trim().toLowerCase() === "card" ||
		(children === undefined || String(children).trim().length === 0)
	);
}

function isPlaceholderTable(component: PlanComponent): boolean {
	if (component.type !== "Table") {
		return false;
	}
	const columns = component.props.columns;
	return (
		Array.isArray(columns) &&
		columns.length === 2 &&
		columns[0] === "Column 1" &&
		columns[1] === "Column 2"
	);
}

function isPlaceholderChart(component: PlanComponent): boolean {
	if (component.type !== "Chart") {
		return false;
	}
	const title = component.props.title;
	const data = component.props.data;
	return (
		(typeof title !== "string" || title.trim().toLowerCase() === "chart") &&
		Array.isArray(data) &&
		data.length === 3 &&
		data.every((value) => typeof value === "number")
	);
}


function enrichComponentsWithDataModel(
	components: PlanComponent[],
	dataModel: DataModel,
	domainAnalysis: DomainAnalysis,
	reasoning: ReasoningOutput
): PlanComponent[] {
	const nextComponents = components.map((component) => ({
		...component,
		props: { ...component.props },
	}));

	const existingIds = new Set(nextComponents.map((component) => component.id));
	const metrics = [...dataModel.metrics];
	let metricIndex = 0;

	for (const component of nextComponents) {
		if (component.type === "Card" && metricIndex < metrics.length && isPlaceholderCard(component)) {
			const metric = metrics[metricIndex++];
			component.props.title = metric.label;
			component.props.children = metric.value;
		}
	}

	while (metricIndex < metrics.length) {
		const metric = metrics[metricIndex++];
		const id = `metric-${slugify(metric.label)}`;
		const uniqueId = existingIds.has(id) ? `${id}-${metricIndex}` : id;
		existingIds.add(uniqueId);
		nextComponents.push({
			id: uniqueId,
			type: "Card",
			props: { id: uniqueId, title: metric.label, children: metric.value },
		});
	}

	const primaryTable = dataModel.tables[0];
	if (primaryTable) {
		const tableComponent = nextComponents.find((component) => component.type === "Table");
		if (tableComponent) {
			if (isPlaceholderTable(tableComponent) || !tableComponent.props.columns) {
				tableComponent.props.columns = primaryTable.columns;
				tableComponent.props.rows = buildTableRows(primaryTable);
			}
		} else {
			const id = primaryTable.id || `table-${slugify(domainAnalysis.domain)}`;
			const uniqueId = existingIds.has(id) ? `${id}-1` : id;
			existingIds.add(uniqueId);
			nextComponents.push({
				id: uniqueId,
				type: "Table",
				props: { id: uniqueId, columns: primaryTable.columns, rows: buildTableRows(primaryTable) },
			});
		}
	}

	const primaryChart = dataModel.charts[0];
	if (primaryChart) {
		const chartComponent = nextComponents.find((component) => component.type === "Chart");
		if (chartComponent) {
			if (isPlaceholderChart(chartComponent) || !chartComponent.props.data) {
				chartComponent.props.title = `${
					reasoning.domainModel.productOrSystem || reasoning.domainModel.domainType
				} trend`.trim();
				chartComponent.props.data = primaryChart.values;
			}
		} else {
			const id = primaryChart.id || `chart-${slugify(domainAnalysis.domain)}`;
			const uniqueId = existingIds.has(id) ? `${id}-1` : id;
			existingIds.add(uniqueId);
			nextComponents.push({
				id: uniqueId,
				type: "Chart",
				props: {
					id: uniqueId,
					title: `${
						reasoning.domainModel.productOrSystem || reasoning.domainModel.domainType
					} trend`.trim(),
					data: primaryChart.values,
				},
			});
		}
	}

	return nextComponents;
}

const marketingMetricTokens = ["ctr", "cpc", "impressions", "conversions", "click", "ad", "campaign"];

function tokenize(value: string): string[] {
	return value
		.toLowerCase()
		.split(/[^a-z0-9]+/gu)
		.filter((token) => token.length > 0);
}

function hasMarketingMetrics(metrics: DataModel["metrics"]): boolean {
	return metrics.some((metric) =>
		marketingMetricTokens.some((token) => metric.label.toLowerCase().includes(token))
	);
}

function isLikelyMarketingDomain(reasoning: ReasoningOutput): boolean {
	const text = `${reasoning.domainModel.productOrSystem} ${reasoning.domainModel.domainType}`.toLowerCase();
	return /(marketing|ads|advertising|campaign)/u.test(text);
}

export function isDataModelAlignedWithReasoning(
	reasoning: ReasoningOutput,
	dataModel: DataModel
): boolean {
	if (!dataModel.metrics.length) {
		return true;
	}

	const requiredTokens = new Set<string>();
	for (const entry of [
		...reasoning.metricsToTrack,
		...reasoning.dataModelHints.summaryMetricsNeeded,
		...reasoning.entities,
		...reasoning.insightsRequired,
	]) {
		for (const token of tokenize(entry)) {
			requiredTokens.add(token);
		}
	}

	const metricTokens = dataModel.metrics.flatMap((metric) => tokenize(metric.label));
	const overlaps = metricTokens.some((token) => requiredTokens.has(token));

	if (requiredTokens.size > 0 && !overlaps) {
		return false;
	}

	if (!isLikelyMarketingDomain(reasoning) && hasMarketingMetrics(dataModel.metrics)) {
		return false;
	}

	return true;
}

function buildHeuristicPlan(
	userMessage: string,
	reasoning: ReasoningOutput,
	previousPlan?: Plan | null
): Plan {
	const message = userMessage.toLowerCase();
	const type: PlanType = previousPlan ? "modify" : "new";
	const domainAnalysis =
		previousPlan?.domainAnalysis ?? buildDomainAnalysisFromReasoning(reasoning);
	const intentAnalysis = previousPlan?.intentAnalysis ?? inferIntentAnalysis(userMessage);
	intentAnalysis.domain = domainAnalysis.domain;
	const dataModel =
		previousPlan?.dataModel ??
		(needsStructuredData(intentAnalysis.intentType)
			? synthesizeDataModel(reasoning)
			: { metrics: [], tables: [], charts: [] });
	const layout = intentAnalysis.layoutStrategy;

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

		if (needsStructuredData(intentAnalysis.intentType)) {
			const enriched = enrichComponentsWithDataModel(
				components,
				dataModel,
				domainAnalysis,
				reasoning
			);
			components.length = 0;
			components.push(...enriched);
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

	const layoutPlan = buildLayoutPlan(components, dataModel);

	return {
		type,
		layout,
		components,
		changes,
		intentAnalysis,
		domainAnalysis,
		reasoning,
		dataModel,
		layoutPlan,
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

	const changes: PlanChange[] = Array.isArray(candidate.changes)
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
				.filter((change): change is NonNullable<typeof change> => change !== null)
		: [];

	const intentAnalysis = normalizeIntentAnalysis(candidate.intentAnalysis);
	const domainAnalysis = normalizeDomainAnalysis(candidate.domainAnalysis);
	const reasoning = normalizeReasoningOutput(candidate.reasoning);
	const dataModel = normalizeDataModel(candidate.dataModel);
	const layoutPlan = normalizeLayoutPlan(candidate.layoutPlan);

	return {
		type: candidate.type,
		layout: candidate.layout,
		components,
		changes,
		intentAnalysis: intentAnalysis ?? undefined,
		domainAnalysis: domainAnalysis ?? undefined,
		reasoning: reasoning ?? undefined,
		dataModel: dataModel ?? undefined,
		layoutPlan: layoutPlan ?? undefined,
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

function isIntentType(value: unknown): value is IntentType {
	return (
		value === "report" ||
		value === "dashboard" ||
		value === "form" ||
		value === "marketing" ||
		value === "marketing_page" ||
		value === "crud"
	);
}

function isLayoutSectionType(value: unknown): value is LayoutSectionType {
	return value === "metrics" || value === "table" || value === "chart" || value === "mixed";
}

function normalizeIntentAnalysis(value: unknown): IntentAnalysis | null {
	if (!isRecord(value)) {
		return null;
	}

	const intentType = isIntentType(value.intentType) ? value.intentType : null;
	const domain = typeof value.domain === "string" ? value.domain : null;
	const complexity =
		value.complexity === "simple" || value.complexity === "moderate" || value.complexity === "complex"
			? value.complexity
			: null;
	const layoutStrategy = typeof value.layoutStrategy === "string" ? value.layoutStrategy : null;

	if (!intentType || !domain || !complexity || !layoutStrategy) {
		return null;
	}

	return { intentType, domain, complexity, layoutStrategy };
}

function normalizeDomainAnalysis(value: unknown): DomainAnalysis | null {
	if (!isRecord(value)) {
		return null;
	}

	const domain = typeof value.domain === "string" ? value.domain : null;
	const keyEntities = Array.isArray(value.keyEntities)
		? value.keyEntities.filter((entry) => typeof entry === "string")
		: [];
	const inferredIndustry =
		typeof value.inferredIndustry === "string" ? value.inferredIndustry : null;
	const operationalConcepts = Array.isArray(value.operationalConcepts)
		? value.operationalConcepts.filter((entry) => typeof entry === "string")
		: [];

	if (!domain || !inferredIndustry) {
		return null;
	}

	return {
		domain,
		keyEntities,
		inferredIndustry,
		operationalConcepts,
	};
}

function normalizeDataModel(value: unknown): DataModel | null {
	if (!isRecord(value)) {
		return null;
	}

	const metrics = Array.isArray(value.metrics)
		? value.metrics
				.filter((metric) => isRecord(metric))
				.map((metric) => ({
					label: typeof metric.label === "string" ? metric.label : "",
					value: typeof metric.value === "string" ? metric.value : "",
				}))
				.filter((metric) => metric.label && metric.value)
		: [];

	const tables = Array.isArray(value.tables)
		? value.tables
				.filter((table) => isRecord(table))
				.map((table) => ({
					id: typeof table.id === "string" ? table.id : "",
					columns: Array.isArray(table.columns)
						? table.columns.filter((entry) => typeof entry === "string")
						: [],
					rows: Array.isArray(table.rows)
						? table.rows
								.filter((row) => isRecord(row))
								.map((row) => {
									const normalized: Record<string, string | number> = {};
									for (const [key, value] of Object.entries(row)) {
										if (typeof value === "string" || typeof value === "number") {
											normalized[key] = value;
										}
									}
									return normalized;
								})
								.filter((row) => Object.keys(row).length > 0)
							: [],
				}))
				.filter((table) => table.id && table.columns.length > 0)
		: [];

	const charts: DataModel["charts"] = Array.isArray(value.charts)
		? value.charts
				.filter((chart) => isRecord(chart))
				.map((chart) => {
					const type: DataModel["charts"][number]["type"] =
						chart.type === "bar" ? "bar" : "line";
					return {
						id: typeof chart.id === "string" ? chart.id : "",
						type,
						labels: Array.isArray(chart.labels)
							? chart.labels.filter((entry) => typeof entry === "string")
							: [],
						values: Array.isArray(chart.values)
							? chart.values.filter((entry) => typeof entry === "number")
							: [],
					};
				})
				.filter((chart) => chart.id && chart.values.length > 0)
		: [];

	return { metrics, tables, charts };
}

function normalizeLayoutPlan(value: unknown): LayoutPlan | null {
	if (!isRecord(value)) {
		return null;
	}

	const sections = Array.isArray(value.sections)
		? value.sections
				.filter((section) => isRecord(section))
				.map((section) => ({
					id: typeof section.id === "string" ? section.id : "",
					type: isLayoutSectionType(section.type) ? section.type : "mixed",
					title: typeof section.title === "string" ? section.title : undefined,
					purpose: typeof section.purpose === "string" ? section.purpose : undefined,
					components: Array.isArray(section.components)
						? section.components.filter((entry) => typeof entry === "string")
						: [],
				}))
				.filter((section) => section.id)
		: [];

	return { sections };
}

function normalizeReasoningOutput(value: unknown): ReasoningOutput | null {
	if (!isRecord(value)) {
		return null;
	}

	const domainModel = value.domainModel;
	if (!isRecord(domainModel)) {
		return null;
	}

	const productOrSystem =
		typeof domainModel.productOrSystem === "string" ? domainModel.productOrSystem : null;
	const domainType = typeof domainModel.domainType === "string" ? domainModel.domainType : null;
	const userRole = typeof domainModel.userRole === "string" ? domainModel.userRole : null;
	const primaryGoal =
		typeof domainModel.primaryGoal === "string" ? domainModel.primaryGoal : null;

	if (!productOrSystem || !domainType || !userRole || !primaryGoal) {
		return null;
	}

	const dataModelHints = value.dataModelHints;
	if (!isRecord(dataModelHints)) {
		return null;
	}

	const tablesNeeded = Array.isArray(dataModelHints.tablesNeeded)
		? dataModelHints.tablesNeeded.filter((entry) => typeof entry === "string")
		: [];
	const chartsNeeded = Array.isArray(dataModelHints.chartsNeeded)
		? dataModelHints.chartsNeeded.filter((entry) => typeof entry === "string")
		: [];
	const summaryMetricsNeeded = Array.isArray(dataModelHints.summaryMetricsNeeded)
		? dataModelHints.summaryMetricsNeeded.filter((entry) => typeof entry === "string")
		: [];

	return {
		domainModel: {
			productOrSystem,
			domainType,
			userRole,
			primaryGoal,
		},
		entities: Array.isArray(value.entities)
			? value.entities.filter((entry) => typeof entry === "string")
			: [],
		insightsRequired: Array.isArray(value.insightsRequired)
			? value.insightsRequired.filter((entry) => typeof entry === "string")
			: [],
		metricsToTrack: Array.isArray(value.metricsToTrack)
			? value.metricsToTrack.filter((entry) => typeof entry === "string")
			: [],
		dataModelHints: {
			tablesNeeded,
			chartsNeeded,
			summaryMetricsNeeded,
		},
	};
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
		const extracted = extractJsonObject(stripCodeFences(raw));
		if (!extracted) {
			throw new PlannerError("Planner returned invalid JSON.", "invalid_json");
		}
		try {
			parsed = JSON.parse(extracted);
		} catch {
			throw new PlannerError("Planner returned invalid JSON.", "invalid_json");
		}
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

function extractJsonObject(value: string): string | null {
	const start = value.indexOf("{");
	if (start < 0) {
		return null;
	}

	let depth = 0;
	let end = -1;
	for (let i = start; i < value.length; i += 1) {
		const char = value[i];
		if (char === "{") {
			depth += 1;
		} else if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				end = i;
				break;
			}
		}
	}

	if (end < 0) {
		return null;
	}

	return value.slice(start, end + 1);
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
	const reasoning =
		request.reasoning ?? request.previousPlan?.reasoning ?? buildFallbackReasoning(request.userMessage);
	const prompt = buildPlannerPrompt(request.userMessage, request.previousPlan, reasoning);
	const sparseRetryPrompt = buildPlannerPrompt(
		request.userMessage,
		request.previousPlan,
		reasoning,
		"Return at least 4 components across multiple sections. Avoid placeholder titles like \"Card\"."
	);

	const isSparsePlan = (plan: Plan) => {
		const intent = plan.intentAnalysis;
		if (!intent) {
			return false;
		}
		if (needsStructuredData(intent.intentType) || wantsDataComponents(request.userMessage)) {
			return false;
		}
		const meaningful = plan.components.filter((component) => {
			if (component.type === "Card") {
				return !isPlaceholderCard(component);
			}
			return true;
		});
		return meaningful.length < 3;
	};

	const finalizePlan = (plan: Plan): Plan => {
		const resolvedReasoning = plan.reasoning ?? reasoning;
		const inferredDomain =
			plan.domainAnalysis ??
			request.previousPlan?.domainAnalysis ??
			buildDomainAnalysisFromReasoning(resolvedReasoning);
		const inferredIntent =
			plan.intentAnalysis ??
			request.previousPlan?.intentAnalysis ??
			inferIntentAnalysis(request.userMessage);
		inferredIntent.domain = inferredDomain.domain;

		const candidateDataModel =
			plan.dataModel ??
			request.previousPlan?.dataModel ??
			(needsStructuredData(inferredIntent.intentType)
				? synthesizeDataModel(resolvedReasoning)
				: { metrics: [], tables: [], charts: [] });

		const dataModel =
			needsStructuredData(inferredIntent.intentType) &&
			!isDataModelAlignedWithReasoning(resolvedReasoning, candidateDataModel)
				? synthesizeDataModel(resolvedReasoning)
				: candidateDataModel;

		let components = plan.components;
		if (
			(plan.type === "new" || plan.type === "regenerate") &&
			needsStructuredData(inferredIntent.intentType)
		) {
			components = components.length
				? enrichComponentsWithDataModel(
					components,
					dataModel,
					inferredDomain,
					resolvedReasoning
				)
				: buildComponentsFromDataModel(dataModel, inferredDomain, resolvedReasoning);
		}

		if (!needsStructuredData(inferredIntent.intentType) && !wantsDataComponents(request.userMessage)) {
			components = components.filter(
				(component) => component.type !== "Chart" && component.type !== "Table"
			);
			dataModel.metrics = [];
			dataModel.tables = [];
			dataModel.charts = [];
		}

		if (!needsStructuredData(inferredIntent.intentType)) {
			components = components.filter((component) => {
				if (component.type === "Card") {
					return !isPlaceholderCard(component);
				}
				return true;
			});
		}

		const layoutPlan =
			plan.layoutPlan ??
			request.previousPlan?.layoutPlan ??
			buildLayoutPlan(components, dataModel);

		return {
			...plan,
			layout: plan.layout || inferredIntent.layoutStrategy,
			components,
			intentAnalysis: inferredIntent,
			domainAnalysis: inferredDomain,
			reasoning: resolvedReasoning,
			dataModel,
			layoutPlan,
		};
	};

	let raw = await client.complete(prompt);
	try {
		let plan = finalizePlan(parsePlan(raw));
		if (isSparsePlan(plan)) {
			raw = await client.complete(sparseRetryPrompt);
			plan = finalizePlan(parsePlan(raw));
		}
		return { plan, raw };
	} catch (error) {
		if (error instanceof PlannerError) {
			if (error.code === "invalid_json" || error.code === "invalid_plan") {
				raw = await client.complete(prompt);
				try {
					let plan = finalizePlan(parsePlan(raw));
					if (isSparsePlan(plan)) {
						raw = await client.complete(sparseRetryPrompt);
						plan = finalizePlan(parsePlan(raw));
					}
					return { plan, raw };
				} catch (retryError) {
					if (retryError instanceof PlannerError && retryError.code === "invalid_plan") {
						return {
							plan: buildHeuristicPlan(
								request.userMessage,
								reasoning,
								request.previousPlan ?? null
							),
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
