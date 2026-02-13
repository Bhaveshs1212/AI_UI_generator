export const ALLOWED_COMPONENTS = [
	"Button",
	"Card",
	"Input",
	"Table",
	"Modal",
	"Sidebar",
	"Navbar",
	"Chart",
] as const;

export type AllowedComponent = (typeof ALLOWED_COMPONENTS)[number];

export type PropValueType =
	| "string"
	| "boolean"
	| "number"
	| "string[]"
	| "number[]"
	| "string[][]"
	| "node";

export interface PropSchema {
	type: PropValueType;
	required: boolean;
	allowedValues?: string[];
}

export type ComponentPropSchema = Record<string, PropSchema>;

export const COMPONENT_PROP_SCHEMA: Record<
	AllowedComponent,
	ComponentPropSchema
> = {
	Button: {
		id: { type: "string", required: true },
		label: { type: "string", required: true },
		variant: {
			type: "string",
			required: true,
			allowedValues: ["primary", "secondary"],
		},
	},
	Card: {
		id: { type: "string", required: true },
		title: { type: "string", required: true },
		children: { type: "node", required: false },
	},
	Input: {
		id: { type: "string", required: true },
		label: { type: "string", required: true },
		placeholder: { type: "string", required: false },
	},
	Table: {
		id: { type: "string", required: true },
		columns: { type: "string[]", required: true },
		rows: { type: "string[][]", required: true },
	},
	Modal: {
		id: { type: "string", required: true },
		title: { type: "string", required: true },
		isOpen: { type: "boolean", required: true },
		children: { type: "node", required: false },
	},
	Sidebar: {
		id: { type: "string", required: true },
		items: { type: "string[]", required: true },
	},
	Navbar: {
		id: { type: "string", required: true },
		title: { type: "string", required: true },
	},
	Chart: {
		id: { type: "string", required: true },
		title: { type: "string", required: true },
		data: { type: "number[]", required: true },
	},
};
