import { ALLOWED_COMPONENTS } from "./componentWhitelist";

interface PromptValidationResult {
	isValid: boolean;
	error?: string;
}

const disallowedPatterns: Array<{ regex: RegExp; message: string }> = [
	{ regex: /<\s*script/iu, message: "Script tags are not allowed." },
	{ regex: /\bimport\b/iu, message: "Imports are not allowed." },
	{ regex: /\braw\s+html\b/iu, message: "Raw HTML is not allowed." },
	{ regex: /\binline\s+style\b/iu, message: "Inline styles are not allowed." },
	{ regex: /style\s*=/iu, message: "Inline styles are not allowed." },
];

const componentSuffixes = [
	"Button",
	"Card",
	"Modal",
	"Sidebar",
	"Navbar",
	"Table",
	"Chart",
	"Input",
];

function findUnknownComponent(message: string): string | null {
	const candidates = message.match(/\b[A-Z][A-Za-z0-9]*\b/gu) ?? [];
	for (const token of candidates) {
		const hasSuffix = componentSuffixes.some((suffix) => token.endsWith(suffix));
		if (!hasSuffix) {
			continue;
		}

		if (!ALLOWED_COMPONENTS.includes(token as (typeof ALLOWED_COMPONENTS)[number])) {
			return token;
		}
	}

	return null;
}

export function validatePromptSafety(userMessage: string): PromptValidationResult {
	const trimmed = userMessage.trim();
	for (const pattern of disallowedPatterns) {
		if (pattern.regex.test(trimmed)) {
			return { isValid: false, error: pattern.message };
		}
	}

	const unknownComponent = findUnknownComponent(trimmed);
	if (unknownComponent) {
		return {
			isValid: false,
			error: `Unknown component requested: ${unknownComponent}.`,
		};
	}

	return { isValid: true };
}
