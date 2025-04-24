import type { BookingDetails, ExecutionResult } from "../types/booking";
import type { FlowDefinition, FlowStep } from "../types/flow";

import { BrowserManager } from "../bot/browser";
import { updateBookingStatus } from "../db";
import { log } from "../utils/log";

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

		const optionsHeadless = options?.headless;
		this.headless =
			optionsHeadless !== undefined
				? optionsHeadless
				: flow.headless !== undefined
					? flow.headless
					: true;
	}

	async execute(bookingId: string | null): Promise<ExecutionResult> {
		log.info(`Executing flow: ${this.flow.name}`);

		try {
			await this.browser.initialize(this.headless);

			const startUrl = this.bookingDetails.url || this.flow.baseUrl;
			log.info(`Starting flow at URL: ${startUrl}`);
			await this.browser.navigateTo(startUrl);

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

				if (currentStep.condition) {
					const conditionMet = await this.evaluateCondition(currentStep);
					if (!conditionMet) {
						log.info(`Condition not met, skipping step: ${currentStepKey}`);
						currentStepKey = currentStep.nextStep || null;
						continue;
					}
				}

				try {
					await this.executeStep(currentStep);
				} catch (error) {
					if (currentStep.optional) {
						log.warn(
							`Optional step failed: ${currentStepKey} - ${error instanceof Error ? error.message : String(error)}`,
						);
					} else {
						throw error;
					}
				}

				currentStepKey = currentStep.nextStep || null;

				if (!currentStepKey) {
					continueExecution = false;
				}
			}

			log.success("Flow execution completed successfully");
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
			} else {
				log.error(`Flow execution failed: ${String(error)}`);
			}
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

		const currentStepKey = Object.entries(this.flow.steps).find(
			([_, stepValue]) => stepValue === step,
		)?.[0];

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

		if (step.waitForTime) {
			await new Promise((resolve) => setTimeout(resolve, step.waitForTime));
		}

		if (step.waitForNavigation) {
			await this.browser.waitForNavigation();
		}
	}

	private resolveValue(value: string | undefined): string {
		if (!value) return "";

		return value
			.replace("{{name}}", this.bookingDetails.name)
			.replace("{{date}}", this.bookingDetails.date)
			.replace("{{time}}", this.bookingDetails.time)
			.replace("{{guests}}", this.bookingDetails.guests.toString());
	}
}
