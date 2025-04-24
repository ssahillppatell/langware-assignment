import { type Browser, type Page, chromium } from "playwright";

export class BrowserManager {
	private browser: Browser | null = null;
	private page: Page | null = null;

	async initialize(headless = true): Promise<void> {
		this.browser = await chromium.launch({ headless });
		this.page = await this.browser.newPage();
	}

	async navigateTo(url: string): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		await this.page.goto(url);
	}

	async elementExists(selector: string, timeout = 5000): Promise<boolean> {
		if (!this.page) throw new Error("Browser not initialized");
		try {
			await this.page.waitForSelector(selector, { timeout });
			return true;
		} catch {
			return false;
		}
	}

	async click(selector: string, timeout = 5000): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		await this.page.waitForSelector(selector, { timeout });
		// bubble up the click event
		await this.page.click(selector);
	}

	async fillInput(
		selector: string,
		value: string,
		timeout = 5000,
	): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		await this.page.waitForSelector(selector, { timeout });
		await this.page.fill(selector, value);
	}

	async select(selector: string, value: string, timeout = 5000): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		await this.page.waitForSelector(selector, { timeout });
		await this.page.selectOption(selector, value);
	}

	async waitForNavigation(timeout = 30000): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		await this.page.waitForNavigation({ timeout });
	}

	async waitForSelector(selector: string, timeout = 5000): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		await this.page.waitForSelector(selector, { timeout });
	}

	async getCurrentUrl(): Promise<string> {
		if (!this.page) throw new Error("Browser not initialized");
		return this.page.url();
	}

	async getHumanVerification(): Promise<void> {
		if (!this.page) throw new Error("Browser not initialized");
		// Pause automation to allow manual intervention
		console.log(
			"\n❗ Human verification required. Please complete the verification in the browser window.",
		);
		console.log("Press Enter after completing verification to continue...");

		// Make browser visible
		if (this.browser) {
			const context = this.page.context();
			await context.close();
			const newContext = await this.browser.newContext();
			this.page = await newContext.newPage();
			await this.page.goto(await this.getCurrentUrl());
		}

		// Wait for user input
		await new Promise((resolve) => {
			process.stdin.once("data", () => {
				resolve(true);
			});
		});
	}

	async close(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
		}
	}
}
