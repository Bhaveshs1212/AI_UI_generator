"use client";

import { useUiStore } from "../../lib/state/uiStore";

export function CodePanel() {
	const { code, explanation } = useUiStore();

	return (
		<section className="app-panel">
			<p className="section-label">Generated JSX</p>
			<h2 className="panel-title">Code Output</h2>
			<pre className="code-block">{code || "// Generated JSX will appear here"}</pre>
			<p className="section-label section-spacer">
				Explanation
			</p>
			<div className="code-block code-block--explain">
				{explanation || "Explanation will appear here"}
			</div>
		</section>
	);
}
