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

export interface Plan {
	type: PlanType;
	layout: string;
	components: PlanComponent[];
	changes: PlanChange[];
}
