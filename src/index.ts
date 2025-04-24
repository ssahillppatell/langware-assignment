#!/usr/bin/env bun

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { FlowExecutor } from './flow/executor';
import { log } from './utils/log';
import { type BookingDetails } from './types/booking';
import { type FlowDefinition } from './types/flow';

// Define the command-line interface
const program = new Command();

program
  .name('find_tables')
  .description('RPA bot to find restaurant table availability')
  .argument('<url>', 'URL of the restaurant booking website')
  .argument('<name>', 'Name of the restaurant')
  .argument('<date>', 'Date for reservation (YYYY-MM-DD)')
  .argument('<time>', 'Time for reservation (HH:MM)')
  .argument('<guests>', 'Number of guests')
  .action(async (url, name, date, time, guests) => {
    try {
      const bookingDetails: BookingDetails = {
        url,
        name,
        date,
        time,
        guests: parseInt(guests, 10)
      };

      if (isNaN(bookingDetails.guests) || bookingDetails.guests <= 0) {
        log.error('Number of guests must be a positive number');
        process.exit(1);
      }
      
      // Extract domain from URL to find corresponding flow file
      const domain = new URL(url).hostname.replace('www.', '');
      
      // Look for a flow definition for this domain
      const flowsDir = path.join(process.cwd(), 'flows');
      let flowFile = path.join(flowsDir, `${domain}.json`);
      
      // If no domain-specific flow exists, use default
      if (!existsSync(flowFile)) {
        log.warn(`No specific flow found for ${domain}, using default flow`);
        flowFile = path.join(flowsDir, 'default.json');
        
        if (!existsSync(flowFile)) {
          log.error('Default flow definition not found');
          process.exit(1);
        }
      }
      
      // Load flow definition
      const flowDefinition: FlowDefinition = JSON.parse(readFileSync(flowFile, 'utf-8'));
      
      // Execute the flow
      log.info(`Starting table availability check for ${name} on ${date} at ${time} for ${guests} guests`);
      const executor = new FlowExecutor(flowDefinition, bookingDetails);
      const result = await executor.execute();
      
      // Output result
      if (result.success) {
        log.success(result.message);
        process.exit(0); // Exit with success code
      } else {
        log.error(result.message);
        process.exit(1); // Exit with error code
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