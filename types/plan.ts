export type AllowedComponent =
	| "Button"
	| "Card"
	| "Input"
	| "Table"
	| "Modal"
	| "Sidebar"
	| "Navbar"
	| "Chart";

export type PlanType = "new" | "modify" | "regenerate";

export interface PlanComponent {
	id: string;
	type: AllowedComponent;
	props: Record<string, unknown>;
}

export type ChangeType = "add" | "update" | "remove";

export interface PlanChange {
	id: string;
	type: ChangeType;
	componentType?: AllowedComponent;
	props?: Record<string, unknown>;
}

export type IntentType =
	| "report"
	| "dashboard"
	| "form"
	| "marketing"
	| "marketing_page"
	| "crud";

export type IntentComplexity = "simple" | "moderate" | "complex";

export interface IntentAnalysis {
	intentType: IntentType;
	domain: string;
	complexity: IntentComplexity;
	layoutStrategy: string;
}

export interface DomainAnalysis {
	domain: string;
	keyEntities: string[];
	inferredIndustry: string;
	operationalConcepts: string[];
}

export interface ReasoningDomainModel {
	productOrSystem: string;
	domainType: string;
	userRole: string;
	primaryGoal: string;
}

export interface ReasoningDataModelHints {
	tablesNeeded: string[];
	chartsNeeded: string[];
	summaryMetricsNeeded: string[];
}

export interface ReasoningOutput {
	domainModel: ReasoningDomainModel;
	entities: string[];
	insightsRequired: string[];
	metricsToTrack: string[];
	dataModelHints: ReasoningDataModelHints;
}

export interface DataMetric {
	label: string;
	value: string;
}

export interface DataTable {
	id: string;
	columns: string[];
	rows: Record<string, string | number>[];
}

export interface DataChart {
	id: string;
	type: "line" | "bar";
	labels: string[];
	values: number[];
}

export interface DataModel {
	metrics: DataMetric[];
	tables: DataTable[];
	charts: DataChart[];
}

export type LayoutSectionType = "metrics" | "table" | "chart" | "mixed";

export interface LayoutSection {
	id: string;
	type: LayoutSectionType;
	title?: string;
	purpose?: string;
	components: string[];
}

export interface LayoutPlan {
	sections: LayoutSection[];
}

export interface Plan {
	type: PlanType;
	layout: string;
	components: PlanComponent[];
	changes: PlanChange[];
	intentAnalysis?: IntentAnalysis;
	domainAnalysis?: DomainAnalysis;
	reasoning?: ReasoningOutput;
	dataModel?: DataModel;
	layoutPlan?: LayoutPlan;
}
