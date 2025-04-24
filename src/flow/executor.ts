import type { BookingDetails, ExecutionResult } from "../types/booking";
import type { FlowDefinition, FlowStep } from "../types/flow";

import { BrowserManager } from "../bot/browser";
import { log } from "../utils/log";
import { createBooking, updateBookingStatus } from "../db"; // Added import

export class FlowExecutor {
	private browser: BrowserManager;
	private flow: FlowDefinition;
	private bookingDetails: BookingDetails;
	private headless: boolean;

	constructor(
		flow: FlowDefinition,
		bookingDetails: BookingDetails,
		options?: { headless?: boolean },
	) {
		this.browser = new BrowserManager();
		this.flow = flow;
		this.bookingDetails = bookingDetails;

		// Set headless mode with the following precedence:
		// 1. constructor options.headless
		// 2. flow definition headless property
		// 3. default to true (headless mode)
		const optionsHeadless = options?.headless;
		this.headless =
			optionsHeadless !== undefined
				? optionsHeadless
				: flow.headless !== undefined
					? flow.headless
					: true;
	}

	async execute(): Promise<ExecutionResult> {
		log.info(`Executing flow: ${this.flow.name}`);

		// Declare bookingId here to be accessible in try/catch/finally
		let bookingId: string | null = null;

		try {
			await this.browser.initialize(this.headless); // Set to false for visible browser, true for headless

			// Create initial booking record
			try {
				bookingId = await createBooking(
					this.bookingDetails.name,
					this.bookingDetails.date,
					this.bookingDetails.time,
					this.bookingDetails.guests,
				);
				log.info(`Booking created with ID: ${bookingId}`);
			} catch (dbError) {
				log.error("Failed to create initial booking record:", dbError);
				// Decide if we should stop execution if booking fails
				// For now, we'll log and continue, but the ID will be null
			}

			// Start by navigating to the base URL or the provided URL
			const startUrl = this.bookingDetails.url || this.flow.baseUrl;
			log.info(`Starting flow at URL: ${startUrl}`);
			await this.browser.navigateTo(startUrl);

			// Begin execution at the starting step
			let currentStepKey: string | null = this.flow.startStep;
			let continueExecution = true;

			while (continueExecution && currentStepKey) {
				const currentStep: FlowStep | undefined =
					this.flow.steps[currentStepKey];

				if (!currentStep) {
					throw new Error(
						`Step ${currentStepKey} not found in flow definition`,
					);
				}

				log.info(
					`Executing step: ${currentStepKey} - ${currentStep.description || currentStep.action}`,
				);

				// Check conditions before executing the step
				if (currentStep.condition) {
					const conditionMet = await this.evaluateCondition(currentStep);
					if (!conditionMet) {
						log.info(`Condition not met, skipping step: ${currentStepKey}`);
						currentStepKey = currentStep.nextStep || null;
						continue;
					}
				}

				// Execute the step
				try {
					await this.executeStep(currentStep);
				} catch (error) {
					if (currentStep.optional) {
						if (error instanceof Error) {
							log.warn(
								`Optional step failed: ${currentStepKey} - ${error.message}`,
							);
						}
					} else {
						throw error;
					}
				}

				// Move to the next step
				currentStepKey = currentStep.nextStep || null;

				// If there's no next step, we've reached the end
				if (!currentStepKey) {
					continueExecution = false;
				}
			}

			log.success("Flow execution completed successfully");
			// Update booking status to 'found' on successful completion
			if (bookingId) {
				await updateBookingStatus(bookingId, "found");
			}
			await this.browser.close();
			return {
				success: true,
				message: "Table availability check completed successfully",
			};
		} catch (error) {
			if (error instanceof Error) {
				log.error(`Flow execution failed: ${error.message}`);
			}
			// Update booking status to 'error' on failure
			if (bookingId) {
				await updateBookingStatus(bookingId, "error");
			}
			await this.browser.close();
			return { success: false, message: `Failed with error: ${error}` };
		}
	}

	private async evaluateCondition(step: FlowStep): Promise<boolean> {
		if (step.condition?.exists) {
			return await this.browser.elementExists(step.condition.exists);
		}

		if (step.condition?.notExists) {
			return !(await this.browser.elementExists(step.condition.notExists));
		}

		return true;
	}

	private async executeStep(step: FlowStep): Promise<void> {
		const action = step.action;
		const selector = this.resolveValue(step.selector);
		const value = this.resolveValue(step.value);
		const timeout = step.timeout || 5000;

		// Find current step key by comparing step object with steps in flow
		const currentStepKey = Object.entries(this.flow.steps).find(
			([_, stepValue]) => stepValue === step,
		)?.[0];

		// Check if this is the checkResults step and the selector exists
		if (currentStepKey === "checkResults" && selector) {
			const selectorExists = await this.browser.elementExists(selector);
			if (selectorExists) {
				log.success("Restaurant available");
			}
		}

		switch (action) {
			case "navigate":
				await this.browser.navigateTo(value);
				break;

			case "click":
				if (!selector) throw new Error("Selector is required for click action");
				await this.browser.click(selector, timeout);
				break;

			case "fill":
				if (!selector) throw new Error("Selector is required for fill action");
				if (value === undefined)
					throw new Error("Value is required for fill action");
				await this.browser.fillInput(selector, value, timeout);
				break;

			case "select":
				if (!selector)
					throw new Error("Selector is required for select action");
				if (value === undefined)
					throw new Error("Value is required for select action");
				await this.browser.select(selector, value, timeout);
				break;

			case "wait":
				await new Promise((resolve) => setTimeout(resolve, timeout));
				break;

			case "waitForSelector":
				if (!selector)
					throw new Error("Selector is required for waitForSelector action");
				await this.browser.waitForSelector(selector, timeout);
				break;

			case "humanVerification":
				await this.browser.getHumanVerification();
				break;

			default:
				throw new Error(`Unknown action: ${action}`);
		}

		// Wait for the selector if specified
		if (step.waitForTime) {
			await new Promise((resolve) => setTimeout(resolve, step.waitForTime));
		}

		// Wait for navigation if specified
		if (step.waitForNavigation) {
			await this.browser.waitForNavigation();
		}
	}

	private resolveValue(value: string | undefined): string {
		if (!value) return "";

		// Replace placeholder variables with actual booking details
		return value
			.replace("{{name}}", this.bookingDetails.name)
			.replace("{{date}}", this.bookingDetails.date)
			.replace("{{time}}", this.bookingDetails.time)
			.replace("{{guests}}", this.bookingDetails.guests.toString());
	}
}
