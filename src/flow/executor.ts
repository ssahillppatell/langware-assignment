import { type BookingDetails, type ExecutionResult } from '../types/booking';
import { type FlowDefinition, type FlowStep } from '../types/flow';

import { BrowserManager } from '../bot/browser';
import { log } from '../utils/log';

export class FlowExecutor {
  private browser: BrowserManager;
  private flow: FlowDefinition;
  private bookingDetails: BookingDetails;

  constructor(flow: FlowDefinition, bookingDetails: BookingDetails) {
    this.browser = new BrowserManager();
    this.flow = flow;
    this.bookingDetails = bookingDetails;
  }

  async execute(): Promise<ExecutionResult> {
    try {
      await this.browser.initialize(false); // Set to false for visible browser, true for headless
      
      // Start by navigating to the base URL or the provided URL
      const startUrl = this.bookingDetails.url || this.flow.baseUrl;
      log.info(`Starting flow at URL: ${startUrl}`);
      await this.browser.navigateTo(startUrl);
      
      // Begin execution at the starting step
      let currentStepKey = this.flow.startStep;
      let continueExecution = true;
      
      while (continueExecution && currentStepKey) {
        const currentStep = this.flow.steps[currentStepKey];
        
        if (!currentStep) {
          throw new Error(`Step ${currentStepKey} not found in flow definition`);
        }
        
        log.info(`Executing step: ${currentStepKey} - ${currentStep.description || currentStep.action}`);
        
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
            log.warn(`Optional step failed: ${currentStepKey} - ${error.message}`);
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
      
      log.success('Flow execution completed successfully');
      await this.browser.close();
      return { success: true, message: 'Table availability check completed successfully' };
      
    } catch (error) {
      log.error(`Flow execution failed: ${error.message}`);
      await this.browser.close();
      return { success: false, message: `Failed: ${error.message}` };
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
    
    switch (action) {
      case 'navigate':
        await this.browser.navigateTo(value);
        break;
      
      case 'click':
        if (!selector) throw new Error('Selector is required for click action');
        await this.browser.click(selector, timeout);
        break;
      
      case 'fill':
        if (!selector) throw new Error('Selector is required for fill action');
        if (value === undefined) throw new Error('Value is required for fill action');
        await this.browser.fillInput(selector, value, timeout);
        break;
      
      case 'select':
        if (!selector) throw new Error('Selector is required for select action');
        if (value === undefined) throw new Error('Value is required for select action');
        await this.browser.select(selector, value, timeout);
        break;
      
      case 'wait':
        await new Promise(resolve => setTimeout(resolve, timeout));
        break;
      
      case 'waitForSelector':
        if (!selector) throw new Error('Selector is required for waitForSelector action');
        await this.browser.waitForSelector(selector, timeout);
        break;
      
      case 'humanVerification':
        await this.browser.getHumanVerification();
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Wait for the selector if specified
    if (step.waitForTime) {
      await new Promise(resolve => setTimeout(resolve, step.waitForTime));
    }
    
    // Wait for navigation if specified
    if (step.waitForNavigation) {
      await this.browser.waitForNavigation();
    }
  }
  
  private resolveValue(value: string | undefined): string {
    if (!value) return '';
    
    // Replace placeholder variables with actual booking details
    return value
      .replace('{{name}}', this.bookingDetails.name)
      .replace('{{date}}', this.bookingDetails.date)
      .replace('{{time}}', this.bookingDetails.time)
      .replace('{{guests}}', this.bookingDetails.guests.toString());
  }
}