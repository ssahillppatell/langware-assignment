import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { FlowExecutor } from "./flow/executor";
import type { BookingDetails } from "./types/booking";
import type { FlowDefinition } from "./types/flow";
import { log } from "./utils/log";
import { createBooking } from "./db";

const program = new Command();

program
	.name("find_tables")
	.description("RPA bot to find restaurant table availability")
	.argument("<url>", "URL of the restaurant booking website")
	.argument("<name>", "Name of the restaurant")
	.argument("<date>", "Date for reservation (YYYY-MM-DD)")
	.argument("<time>", "Time for reservation (HH:MM)")
	.argument("<guests>", "Number of guests")
	.option("--no-headless", "Run with a visible browser window (disable headless mode)")
	.action(async (url, name, date, time, guests, options: { headless?: boolean }) => {
		// Input Validation
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

			const domain = new URL(url).hostname.replace("www.", "");

			let flowFile = path.join(process.cwd(), "flows", `${domain}.json`);

			if (!existsSync(flowFile)) {
				flowFile = path.join(process.cwd(), "flows", "default.json");

				if (!existsSync(flowFile)) {
					log.error("Default flow definition not found");
					process.exit(1);
				}
			}

			const flowDefinition: FlowDefinition = JSON.parse(
				readFileSync(flowFile, "utf-8"),
			);

			log.info(
				`Starting table availability check for ${name} on ${date} at ${time} for ${guests} guests`,
			);
			// Determine headless mode: Commander sets options.headless to false if --no-headless is used.
			// If the flag is omitted, options.headless will be undefined, so we default to true.
			const runHeadless = options.headless === undefined ? true : options.headless;

			// Store options as JSON string
			const optionsString = JSON.stringify({ headless: runHeadless });

			let bookingId: string | null = null;
			try {
				// Create booking record *before* starting the flow execution
				bookingId = await createBooking(
					bookingDetails.name,
					bookingDetails.date,
					bookingDetails.time,
					bookingDetails.guests,
					optionsString, // Pass the stringified options
				);
			} catch (dbError: unknown) {
				if (dbError instanceof Error) {
					log.error(`Database error during booking creation: ${dbError.message}`);
				} else {
					log.error("Database error during booking creation: Unknown error");
				}
				process.exit(1);
			}

			try {
				// Now execute the flow
				const executor = new FlowExecutor(flowDefinition, bookingDetails, {
					headless: runHeadless,
				});
				const result = await executor.execute(bookingId); // Pass bookingId to execute

				log.info(`Flow execution completed with result: ${result.success ? 'success' : 'error'}`);
				if (bookingId) {
					if (result.success) {
						log.success(result.message);
						process.exit(0); 
					} else {
						log.error(result.message);
						process.exit(1); 
					}
				}
			} catch (error: unknown) {
				if (error instanceof Error) {
					log.error(`Execution failed: ${error.message}`);
				} else {
					log.error(`Execution failed: ${String(error)}`);
				}
				process.exit(1);
			}
		} catch (error: unknown) {
			if (error instanceof Error) {
				log.error(`Execution failed: ${error.message}`);
			} else {
				log.error(`Execution failed: ${String(error)}`);
			}
			process.exit(1);
		}
	});

program.parse();
