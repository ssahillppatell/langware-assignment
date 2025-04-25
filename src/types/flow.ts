export interface FlowStep {
	action: string;
	selector?: string;
	value?: string;
	timeout?: number;
	description?: string;
	waitForTime?: number;
	waitForNavigation?: boolean;
	optional?: boolean;
	condition?: {
		exists?: string;
		notExists?: string;
	};
	nextStep?: string | null;
}

export interface FlowDefinition {
	name: string;
	baseUrl: string;
	headless?: boolean;
	startStep: string;
	dateFormat: string;
	timeFormat: string;
	steps: Record<string, FlowStep>;
}
