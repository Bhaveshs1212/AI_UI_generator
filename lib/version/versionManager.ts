import type { Plan } from "../../types/plan";
import type { Version } from "../../types/version";

const versions: Version[] = [];
let currentVersionIndex = -1;
let versionCounter = 0;

export function getVersions(): Version[] {
	return [...versions];
}

export function getCurrentVersion(): Version | null {
	if (currentVersionIndex < 0 || currentVersionIndex >= versions.length) {
		return null;
	}

	return versions[currentVersionIndex];
}

export function getCurrentVersionIndex(): number {
	return currentVersionIndex;
}

export function addVersion(params: {
	plan: Plan;
	code: string;
	explanation: string;
}): Version {
	const version: Version = {
		id: `v-${versionCounter++}`,
		plan: params.plan,
		code: params.code,
		explanation: params.explanation,
		timestamp: Date.now(),
	};

	versions.push(version);
	currentVersionIndex = versions.length - 1;

	return version;
}

export function rollbackVersion(): Version | null {
	if (currentVersionIndex <= 0) {
		return getCurrentVersion();
	}

	currentVersionIndex -= 1;
	return getCurrentVersion();
}

export function resetVersions(): void {
	versions.length = 0;
	currentVersionIndex = -1;
	versionCounter = 0;
}
