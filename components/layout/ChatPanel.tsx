"use client";

import { useUiStore } from "../../lib/state/uiStore";

export function ChatPanel() {
	const {
		userMessage,
		setUserMessage,
		generate,
		regenerate,
		modify,
		rollback,
		versions,
		currentVersionIndex,
		selectVersion,
		isLoading,
		error,
		validation,
	} = useUiStore();

	const canRollback = currentVersionIndex > 0;

	return (
		<section className="app-panel app-left">
			<div>
				<p className="section-label">Prompt</p>
				<h2 className="panel-title">Design Brief</h2>
				<textarea
					className="textarea"
					placeholder="Describe the UI you want..."
					value={userMessage}
					onChange={(event) => setUserMessage(event.target.value)}
				/>
			</div>

			<div>
				<p className="section-label">Controls</p>
				<div className="button-row">
					<button className="app-button" onClick={() => void generate()} disabled={isLoading}>
						Generate
					</button>
					<button className="app-button secondary" onClick={() => void regenerate()} disabled={isLoading}>
						Regenerate
					</button>
					<button className="app-button secondary" onClick={() => void modify()} disabled={isLoading}>
						Modify
					</button>
					<button
						className="app-button secondary"
						onClick={rollback}
						disabled={isLoading || !canRollback}
					>
						Rollback
					</button>
				</div>
			</div>

			<div>
				<p className="section-label">Versions</p>
				<div className="version-list">
					{versions.length === 0 && <div className="status-pill">No versions yet</div>}
					{versions.map((version, index) => (
						<button
							key={`${version.id}-${index}`}
							type="button"
							className={`version-item ${index === currentVersionIndex ? "active" : ""}`}
							onClick={() => selectVersion(index)}
						>
							<div>Version {index + 1}</div>
							<div className="section-label">{new Date(version.timestamp).toLocaleString()}</div>
						</button>
					))}
				</div>
			</div>

			<div>
				<p className="section-label">Status</p>
				{error ? (
					<div className="status-pill error">{error}</div>
				) : validation ? (
					<div className="status-pill">
						Component check: {validation.componentCheck ? "ok" : "fail"} | Prop check:{" "}
						{validation.propCheck ? "ok" : "fail"}
					</div>
				) : (
					<div className="status-pill">Ready</div>
				)}
			</div>
		</section>
	);
}
