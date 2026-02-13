import type { Plan } from "./plan";

export interface Version {
	id: string;
	plan: Plan;
	code: string;
	explanation: string;
	timestamp: number;
}
