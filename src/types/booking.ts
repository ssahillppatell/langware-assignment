export interface BookingDetails {
	url: string;
	name: string;
	date: string;
	time: string;
	guests: number;
}

export interface ExecutionResult {
	success: boolean;
	message: string;
}
