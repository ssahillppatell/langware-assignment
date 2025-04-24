#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { FlowExecutor } from "./flow/executor";
import type { BookingDetails } from "./types/booking";
import type { FlowDefinition } from "./types/flow";
import { log } from "./utils/log";

const program = new Command();

program
	.name("find_tables")
	.description("RPA bot to find restaurant table availability")
	.argument("<url>", "URL of the restaurant booking website")
	.argument("<name>", "Name of the restaurant")
	.argument("<date>", "Date for reservation (YYYY-MM-DD)")
	.argument("<time>", "Time for reservation (HH:MM)")
	.argument("<guests>", "Number of guests")
	.option("--ui", "Run with visible browser UI (disable headless mode)")
	.action(async (url, name, date, time, guests, options: { ui?: boolean }) => {
		try {
			const bookingDetails: BookingDetails = {
				url,
				name,
				date,
				time,
				guests: Number.parseInt(guests, 10),
			};

			if (Number.isNaN(bookingDetails.guests) || bookingDetails.guests <= 0) {
				log.error("Number of guests must be a positive number");
				process.exit(1);
			}

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
			const executor = new FlowExecutor(flowDefinition, bookingDetails, {
				headless: !options.ui,
			});
			const result = await executor.execute();

			if (result.success) {
				log.success(result.message);
				process.exit(0); 
			} else {
				log.error(result.message);
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
