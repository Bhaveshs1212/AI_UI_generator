"use client";

import { renderValidatedJsx } from "../../lib/renderer/safeRenderer";
import { useUiStore } from "../../lib/state/uiStore";

export function PreviewPanel() {
	const { code } = useUiStore();
	const renderResult = code ? renderValidatedJsx(code) : null;

	return (
		<section className="app-panel">
			<p className="section-label">Live Preview</p>
			<h2 className="panel-title">Rendered Output</h2>
			<div className="preview-stage">
				{!code && <div className="status-pill">No JSX to render yet.</div>}
				{renderResult?.element}
				{renderResult && renderResult.errors.length > 0 && (
					<div className="status-pill error">{renderResult.errors.join(" ")}</div>
				)}
			</div>
		</section>
	);
}
