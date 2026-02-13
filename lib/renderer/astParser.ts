import { parse } from "@babel/parser";
import type { File } from "@babel/types";

export interface ParsedJsx {
	ast: File;
	wrapped: boolean;
}

export function parseJsx(code: string): ParsedJsx {
	try {
		return {
			ast: parse(code, {
				sourceType: "module",
				plugins: ["jsx", "typescript"],
			}),
			wrapped: false,
		};
	} catch {
		const wrappedCode = `const __ui = (${code});`;
		return {
			ast: parse(wrappedCode, {
				sourceType: "module",
				plugins: ["jsx", "typescript"],
			}),
			wrapped: true,
		};
	}
}
