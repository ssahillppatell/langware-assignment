import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { createBooking, initializeDb, updateBookingStatus } from "./db";
import { FlowExecutor } from "./flow/executor";
import type { BookingDetails } from "./types/booking";
import type { FlowDefinition } from "./types/flow";
import { formatDate, formatTime } from "./utils/date";
import { log } from "./utils/log";

export type BotRunOptions = {
	headless: boolean;
	mode: "cli" | "ui";
};

initializeDb();

async function runBotTask(
	bookingDetails: BookingDetails,
	options: BotRunOptions,
) {
	log.info(
		`Starting table availability check for ${bookingDetails.name} on ${bookingDetails.date} at ${bookingDetails.time} for ${bookingDetails.guests} guests (Mode: ${options.mode}, Headless: ${options.headless})`,
	);

	const domain = new URL(bookingDetails.url).hostname.replace("www.", "");
	log.debug(`Domain: ${domain}`);
	const urlPath = new URL(bookingDetails.url).pathname.replaceAll('/', '.');
	log.debug(`URL Path: ${urlPath}`);
	const flowFileName = `${domain}${urlPath === '.' ? '' : urlPath}.json`;

	log.debug(`Flow file name: ${flowFileName}`);

	let flowFile = path.join(process.cwd(), "flows", flowFileName);
	if (!existsSync(flowFile)) {
		flowFile = path.join(process.cwd(), "flows", "default.json");
		if (!existsSync(flowFile)) {
			log.error(
				`No specific flow file found for ${domain} and default.json is missing.`,
			);
			process.exit(1);
		}
		log.warn(`No specific flow file found for ${domain}. Using default.json`);
	}

	const flowDefinition: FlowDefinition = JSON.parse(
		readFileSync(flowFile, "utf-8"),
	);

	const formattedDate = formatDate(
		bookingDetails.date,
		flowDefinition.dateFormat,
	);
	const formattedTime = formatTime(
		bookingDetails.time,
		flowDefinition.timeFormat,
	);

	const optionsString = JSON.stringify(options);

	let bookingId: string | null = null;
	try {
		bookingId = await createBooking(
			bookingDetails.url,
			bookingDetails.name,
			formattedDate,
			formattedTime,
			bookingDetails.guests,
			optionsString,
		);

		const executor = new FlowExecutor(flowDefinition, bookingDetails, {
			headless: options.headless,
		});
		const result = await executor.execute(bookingId);

		log.info(
			`Flow execution completed with result: ${result.success ? "success" : "error"}`,
		);
		if (result.success) {
			log.success(result.message);
			return { success: true, message: result.message };
		}
		log.error(result.message);
		return { success: false, message: result.message };
	} catch (error: unknown) {
		let errorMessage = "Execution failed: Unknown error";
		if (error instanceof Error) {
			errorMessage = `Execution failed: ${error.message}`;
		}
		log.error(errorMessage);
		if (bookingId) {
			try {
				await updateBookingStatus(bookingId, "error");
			} catch (updateError) {
				log.error(
					`Failed to update booking status to error for ${bookingId}: ${updateError}`,
				);
			}
		}
		return { success: false, message: errorMessage };
	}
}

const program = new Command();

program
	.name("find_tables")
	.description(
		"RPA bot to find restaurant table availability. Provide arguments OR use --ui flag.",
	)
	.argument(
		"[url]",
		"URL of the restaurant booking website (required if not using --ui)",
	)
	.argument("[name]", "Name of the restaurant (required if not using --ui)")
	.argument(
		"[date]",
		"Date for reservation (YYYY-MM-DD) (required if not using --ui)",
	)
	.argument(
		"[time]",
		"Time for reservation (HH:MM) (required if not using --ui)",
	)
	.argument("[guests]", "Number of guests (required if not using --ui)")
	.option(
		"--no-headless",
		"Run with a visible browser window (disable headless mode)",
	)
	.option(
		"--ui",
		"Launch a web UI to enter booking details instead of using CLI arguments.",
	)
	.action(
		async (
			url,
			name,
			date,
			time,
			guests,
			cmdOptions: { headless?: boolean; ui?: boolean },
		) => {
			log.info("Starting bot...", url, name, date, time, guests, cmdOptions);
			const runHeadless = cmdOptions.headless ?? true;

			if (cmdOptions.ui) {
				log.info("Launching Web UI mode...");
				try {
					const { startServer } = await import("./server");
					const startOptions: BotRunOptions = {
						headless: runHeadless,
						mode: "ui",
					};
					await startServer(runBotTask, startOptions);
				} catch (serverError) {
					log.error("Failed to start UI server:", serverError);
					process.exit(1);
				}
			} else {
				if (!url || !date || !time || !guests) {
					log.error(
						"URL, Name, Date, Time, and Guests arguments are required when not using --ui flag.",
					);
					program.help();
					process.exit(1);
				}

				const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
				const timeRegex = /^\d{2}:\d{2}$/;

				if (!dateRegex.test(date)) {
					log.error("Invalid date format. Please use YYYY-MM-DD.");
					process.exit(1);
				}

				if (!timeRegex.test(time)) {
					log.error("Invalid time format. Please use HH:MM (24-hour format).");
					process.exit(1);
				}

				const parsedGuests = Number.parseInt(guests, 10);
				if (Number.isNaN(parsedGuests) || parsedGuests <= 0) {
					log.error("Number of guests must be a positive number");
					process.exit(1);
				}

				try {
					const bookingDetails: BookingDetails = {
						url,
						name,
						date,
						time,
						guests: parsedGuests,
					};

					const runOptions: BotRunOptions = {
						headless: runHeadless,
						mode: "cli",
					};

					const result = await runBotTask(bookingDetails, runOptions);

					process.exit(result.success ? 0 : 1);
				} catch (error: unknown) {
					if (error instanceof Error) {
						log.error(`CLI execution failed: ${error.message}`);
					} else {
						log.error(`CLI execution failed: ${String(error)}`);
					}
					process.exit(1);
				}
			}
		},
	);

program.parse();
