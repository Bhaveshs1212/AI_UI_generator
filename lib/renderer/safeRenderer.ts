import React from "react";
import traverse from "@babel/traverse";
import type {
	ArrayExpression,
	Expression,
	JSXAttribute,
	JSXElement,
	JSXExpressionContainer,
	JSXFragment,
} from "@babel/types";
import { parseJsx } from "./astParser";
import { validateJsx, type JsxValidationResult } from "../validation/jsxValidator";
import { Button } from "../../components/system/Button";
import { Card } from "../../components/system/Card";
import { Input } from "../../components/system/Input";
import { Table } from "../../components/system/Table";
import { Modal } from "../../components/system/Modal";
import { Sidebar } from "../../components/system/Sidebar";
import { Navbar } from "../../components/system/Navbar";
import { Chart } from "../../components/system/Chart";

const componentMap = {
	Button,
	Card,
	Input,
	Table,
	Modal,
	Sidebar,
	Navbar,
	Chart,
} as const;

interface EvaluatedValue {
	value: unknown;
}

export interface SafeRenderResult {
	element: React.ReactNode | null;
	errors: string[];
	validation: JsxValidationResult;
}

type JsxChildNode = JSXElement["children"][number] | JSXFragment["children"][number];

function isMeaningfulChild(child: JsxChildNode): boolean {
	if (child.type === "JSXText") {
		return child.value.trim().length > 0;
	}

	return child.type !== "JSXEmptyExpression";
}

function getAttributeName(attr: JSXAttribute): string {
	if (attr.name.type === "JSXIdentifier") {
		return attr.name.name;
	}

	return "";
}

function evalExpression(expression: Expression): EvaluatedValue | null {
	if (expression.type === "StringLiteral") {
		return { value: expression.value };
	}

	if (expression.type === "NumericLiteral") {
		return { value: expression.value };
	}

	if (expression.type === "BooleanLiteral") {
		return { value: expression.value };
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
		return { value: [] };
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

		return { value: rows };
	}

	if (first.type === "StringLiteral") {
		const values: string[] = [];
		for (const element of elements) {
			if (!element || element.type !== "StringLiteral") {
				return null;
			}

			values.push(element.value);
		}

		return { value: values };
	}

	if (first.type === "NumericLiteral") {
		const values: number[] = [];
		for (const element of elements) {
			if (!element || element.type !== "NumericLiteral") {
				return null;
			}

			values.push(element.value);
		}

		return { value: values };
	}

	return null;
}

function withStableKeys(children: React.ReactNode[]): React.ReactNode[] {
	return children.map((child, index) => {
		if (React.isValidElement(child) && child.key == null) {
			return React.cloneElement(child, { key: `sr-${index}` });
		}

		return child;
	});
}

function evalAttributeValue(attribute: JSXAttribute): EvaluatedValue | null {
	if (!attribute.value) {
		return { value: true };
	}

	if (attribute.value.type === "StringLiteral") {
		return { value: attribute.value.value };
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

function renderJsxElement(node: JSXElement, errors: string[]): React.ReactNode {
	const nameNode = node.openingElement.name;
	if (nameNode.type !== "JSXIdentifier") {
		errors.push("JSX member expressions are not allowed.");
		return null;
	}

	const component = componentMap[nameNode.name as keyof typeof componentMap];
	if (!component) {
		errors.push(`Unknown component: ${nameNode.name}.`);
		return null;
	}

	const props: Record<string, unknown> = {};
	for (const attribute of node.openingElement.attributes) {
		if (attribute.type !== "JSXAttribute") {
			errors.push(`Unsupported attribute syntax in ${nameNode.name}.`);
			continue;
		}

		const attrName = getAttributeName(attribute);
		if (!attrName) {
			errors.push(`Unsupported attribute syntax in ${nameNode.name}.`);
			continue;
		}

		if (attrName === "style") {
			errors.push("Inline styles are not allowed.");
			continue;
		}

		const evaluated = evalAttributeValue(attribute);
		if (!evaluated) {
			errors.push(`Invalid value for prop "${attrName}" on ${nameNode.name}.`);
			continue;
		}

		props[attrName] = evaluated.value;
	}

	const children: React.ReactNode[] = [];
	for (const child of node.children) {
		if (!isMeaningfulChild(child)) {
			continue;
		}

		if (child.type === "JSXText") {
			children.push(child.value);
			continue;
		}

		if (child.type === "JSXElement") {
			children.push(renderJsxElement(child, errors));
			continue;
		}

		if (child.type === "JSXFragment") {
			children.push(renderJsxFragment(child, errors));
			continue;
		}

		if (child.type === "JSXExpressionContainer") {
			const expression = (child as JSXExpressionContainer).expression;
			if (expression.type === "JSXEmptyExpression") {
				continue;
			}

			const evaluated = evalExpression(expression as Expression);
			if (!evaluated) {
				errors.push("Unsupported expression in JSX child.");
				continue;
			}

			children.push(evaluated.value as React.ReactNode);
		}
	}

	const keyedChildren = children.length ? withStableKeys(children) : undefined;
	return React.createElement(component, props, keyedChildren);
}

function renderJsxFragment(fragment: JSXFragment, errors: string[]): React.ReactNode {
	const children: React.ReactNode[] = [];

	for (const child of fragment.children) {
		if (!isMeaningfulChild(child)) {
			continue;
		}

		if (child.type === "JSXText") {
			children.push(child.value);
			continue;
		}

		if (child.type === "JSXElement") {
			children.push(renderJsxElement(child, errors));
			continue;
		}

		if (child.type === "JSXFragment") {
			children.push(renderJsxFragment(child, errors));
			continue;
		}

		if (child.type === "JSXExpressionContainer") {
			const expression = (child as JSXExpressionContainer).expression;
			if (expression.type === "JSXEmptyExpression") {
				continue;
			}

			const evaluated = evalExpression(expression as Expression);
			if (!evaluated) {
				errors.push("Unsupported expression in JSX child.");
				continue;
			}

			children.push(evaluated.value as React.ReactNode);
		}
	}

	const keyedChildren = children.length ? withStableKeys(children) : undefined;
	return React.createElement(React.Fragment, null, keyedChildren);
}

function findRootNode(code: string, errors: string[]): JSXElement | JSXFragment | null {
	const parsed = parseJsx(code);
	let root: JSXElement | JSXFragment | null = null;

	traverse(parsed.ast, {
		JSXElement(path) {
			if (!root) {
				root = path.node;
				path.stop();
			}
		},
		JSXFragment(path) {
			if (!root) {
				root = path.node;
				path.stop();
			}
		},
	});

	if (!root) {
		errors.push("No JSX element found in generated code.");
	}

	return root;
}

export function renderValidatedJsx(code: string): SafeRenderResult {
	const validation = validateJsx(code);
	const errors = [...validation.errors];

	if (!validation.isValid) {
		return { element: null, errors, validation };
	}

	const root = findRootNode(code, errors);
	if (!root || errors.length > 0) {
		return { element: null, errors, validation };
	}

	const element =
		root.type === "JSXElement"
			? renderJsxElement(root, errors)
			: renderJsxFragment(root, errors);

	if (errors.length > 0) {
		return { element: null, errors, validation };
	}

	return { element, errors, validation };
}
