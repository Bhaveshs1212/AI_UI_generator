import traverse from "@babel/traverse";
import type {
	ArrayExpression,
	Expression,
	JSXAttribute,
	JSXExpressionContainer,
	JSXIdentifier,
	JSXElement,
	JSXFragment,
	JSXOpeningElement,
} from "@babel/types";
import {
	ALLOWED_COMPONENTS,
	COMPONENT_PROP_SCHEMA,
} from "./componentWhitelist";
import { parseJsx } from "../renderer/astParser";

export interface JsxValidationResult {
	isValid: boolean;
	errors: string[];
	componentCheck: boolean;
	propCheck: boolean;
}

interface EvaluatedValue {
	type:
		| "string"
		| "number"
		| "boolean"
		| "string[]"
		| "number[]"
		| "string[][]"
		| "empty[]";
	value: unknown;
}

type JsxChildNode = JSXElement["children"][number] | JSXFragment["children"][number];

function isMeaningfulChild(child: JsxChildNode): boolean {
	if (child.type === "JSXText") {
		return child.value.trim().length > 0;
	}

	if (child.type === "JSXExpressionContainer") {
		return child.expression.type !== "JSXEmptyExpression";
	}

	return true;
}

function getJsxName(node: JSXOpeningElement): string | null {
	if (node.name.type === "JSXIdentifier") {
		return node.name.name;
	}

	return null;
}

function getAttributeName(attr: JSXAttribute): string {
	if (attr.name.type === "JSXIdentifier") {
		return attr.name.name;
	}

	return "";
}

function evalExpression(expression: Expression): EvaluatedValue | null {
	if (expression.type === "StringLiteral") {
		return { type: "string", value: expression.value };
	}

	if (expression.type === "NumericLiteral") {
		return { type: "number", value: expression.value };
	}

	if (expression.type === "BooleanLiteral") {
		return { type: "boolean", value: expression.value };
	}

	if (expression.type === "ArrayExpression") {
		return evalArrayExpression(expression);
	}

	return null;
}

function evalArrayExpression(expression: ArrayExpression): EvaluatedValue | null {
	const elements = expression.elements;
	if (elements.some((element) => !element || element.type === "SpreadElement")) {
		return null;
	}

	if (elements.length === 0) {
		return { type: "empty[]", value: [] };
	}

	const first = elements[0] as Expression;

	if (first.type === "ArrayExpression") {
		const rows: string[][] = [];

		for (const element of elements) {
			if (!element || element.type !== "ArrayExpression") {
				return null;
			}

			const rowValues: string[] = [];
			for (const rowElement of element.elements) {
				if (!rowElement || rowElement.type !== "StringLiteral") {
					return null;
				}

				rowValues.push(rowElement.value);
			}

			rows.push(rowValues);
		}

		return { type: "string[][]", value: rows };
	}

	if (first.type === "StringLiteral") {
		const values: string[] = [];
		for (const element of elements) {
			if (!element || element.type !== "StringLiteral") {
				return null;
			}

			values.push(element.value);
		}

		return { type: "string[]", value: values };
	}

	if (first.type === "NumericLiteral") {
		const values: number[] = [];
		for (const element of elements) {
			if (!element || element.type !== "NumericLiteral") {
				return null;
			}

			values.push(element.value);
		}

		return { type: "number[]", value: values };
	}

	return null;
}

function evalAttributeValue(
	attribute: JSXAttribute
): EvaluatedValue | null {
	if (!attribute.value) {
		return { type: "boolean", value: true };
	}

	if (attribute.value.type === "StringLiteral") {
		return { type: "string", value: attribute.value.value };
	}

	if (attribute.value.type === "JSXExpressionContainer") {
		const expression = (attribute.value as JSXExpressionContainer).expression;
		if (expression.type === "JSXEmptyExpression") {
			return null;
		}

		return evalExpression(expression as Expression);
	}

	return null;
}

export function validateJsx(code: string): JsxValidationResult {
	const errors: string[] = [];
	const allowed = new Set<string>(ALLOWED_COMPONENTS);
	let componentCheck = true;
	let propCheck = true;

	let parsed;
	try {
		parsed = parseJsx(code);
	} catch (error) {
		return {
			isValid: false,
			errors: ["Invalid JSX: unable to parse"],
			componentCheck: false,
			propCheck: false,
		};
	}

	traverse(parsed.ast, {
		ImportDeclaration(path) {
			errors.push("External imports are not allowed.");
			componentCheck = false;
			path.stop();
		},
	});

	traverse(parsed.ast, {
		JSXOpeningElement(path) {
			const name = getJsxName(path.node);
			if (!name) {
				errors.push("JSX member expressions are not allowed.");
				componentCheck = false;
				return;
			}

			if (!allowed.has(name)) {
				errors.push(`Unknown component: ${name}.`);
				componentCheck = false;
				return;
			}

			const schema = COMPONENT_PROP_SCHEMA[name as keyof typeof COMPONENT_PROP_SCHEMA];
			const provided = new Set<string>();
			const attributes = path.node.attributes.filter(
				(attr): attr is JSXAttribute => attr.type === "JSXAttribute"
			);

			for (const attribute of attributes) {
				const attrName = getAttributeName(attribute);
				if (!attrName) {
					errors.push(`Unsupported attribute syntax in ${name}.`);
					propCheck = false;
					continue;
				}

				if (attrName === "style") {
					errors.push("Inline styles are not allowed.");
					componentCheck = false;
					continue;
				}

				if (!schema[attrName]) {
					errors.push(`Unknown prop "${attrName}" on ${name}.`);
					propCheck = false;
					continue;
				}

				const evaluated = evalAttributeValue(attribute);
				if (!evaluated) {
					errors.push(`Invalid value for prop "${attrName}" on ${name}.`);
					propCheck = false;
					continue;
				}

				const expected = schema[attrName];
				if (expected.allowedValues) {
					if (!expected.allowedValues.includes(String(evaluated.value))) {
						errors.push(`Invalid value for prop "${attrName}" on ${name}.`);
						propCheck = false;
					}
				}

				if (evaluated.type !== expected.type) {
					const isEmptyArray = evaluated.type === "empty[]";
					const expectsArray =
						expected.type === "string[]" ||
						expected.type === "number[]" ||
						expected.type === "string[][]";
					if (!(isEmptyArray && expectsArray)) {
						errors.push(`Type mismatch for prop "${attrName}" on ${name}.`);
						propCheck = false;
					}
				}

				provided.add(attrName);
			}

			for (const [propName, propSchema] of Object.entries(schema)) {
				if (propSchema.required && !provided.has(propName)) {
					errors.push(`Missing required prop "${propName}" on ${name}.`);
					propCheck = false;
				}
			}

			const parentElement = path.parentPath?.node;
			const hasMeaningfulChildren = parentElement?.type === "JSXElement"
				? parentElement.children.some((child) => isMeaningfulChild(child))
				: false;

			if (hasMeaningfulChildren && !schema.children) {
				errors.push(`${name} does not accept children.`);
				propCheck = false;
			}
		},
	});

	return {
		isValid: errors.length === 0,
		errors,
		componentCheck,
		propCheck,
	};
}
