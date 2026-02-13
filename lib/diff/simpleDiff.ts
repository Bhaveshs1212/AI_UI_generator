import type { Plan, PlanComponent } from "../../types/plan";

function componentSignature(component: PlanComponent): string {
	return JSON.stringify({
		type: component.type,
		props: component.props,
	});
}

export function getChangedComponentIds(
	previousPlan: Plan | null,
	nextPlan: Plan
): string[] {
	const changed = new Set<string>();
	const previousMap = new Map<string, PlanComponent>();

	if (previousPlan) {
		for (const component of previousPlan.components) {
			previousMap.set(component.id, component);
		}
	}

	for (const nextComponent of nextPlan.components) {
		const previousComponent = previousMap.get(nextComponent.id);

		if (!previousComponent) {
			changed.add(nextComponent.id);
			continue;
		}

		if (componentSignature(previousComponent) !== componentSignature(nextComponent)) {
			changed.add(nextComponent.id);
		}

		previousMap.delete(nextComponent.id);
	}

	for (const leftoverId of previousMap.keys()) {
		changed.add(leftoverId);
	}

	return Array.from(changed);
}
