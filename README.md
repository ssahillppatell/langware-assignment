# Restaurant Table Availability Bot

This project is an RPA (Robotic Process Automation) bot designed to check the availability of restaurant tables on booking websites.

## Overview

The bot uses Playwright to automate browser interactions based on predefined workflow definitions (flows). It takes booking details (URL, restaurant name, date, time, number of guests) as command-line arguments, navigates the target website according to a domain-specific or default flow, and attempts to determine if a table is available for the specified criteria.

Booking attempts and their final status (pending, found, error) are logged in a local SQLite database (`bookings.sqlite`).

## How It Works

1.  **Input:** The bot is invoked via the command line, providing the target URL, restaurant name, and desired booking details.
2.  **Flow Selection:** It extracts the domain name from the URL and looks for a corresponding JSON flow definition file in the `flows/` directory (e.g., `flows/opentable.com.json`). If a domain-specific flow isn't found, it falls back to `flows/default.json`.
3.  **Flow Execution:** The `FlowExecutor` class reads the selected JSON flow and uses the `BrowserManager` (which wraps Playwright) to execute the defined steps sequentially. Steps can include actions like navigating, clicking buttons, filling forms, and checking for specific elements on the page.
4.  **Database Logging:** An entry is created in the `bookings.sqlite` database when a check starts (status 'pending'). The status is updated to 'found' if the flow completes successfully, indicating availability, or 'error' if any step fails or an exception occurs.
5.  **Output:** The bot logs its progress to the console and prints a final success or failure message.

## Technology Stack

*   **Runtime:** Bun
*   **Language:** TypeScript
*   **Browser Automation:** Playwright
*   **Command-Line Interface:** Commander.js
*   **Database:** SQLite (via `bun:sqlite`)
*   **Logging:** Consola, Chalk

## Project Structure

```
├── flows/               # Contains JSON flow definitions for websites
│   ├── default.json
│   └── ontopo.com.json  # Example domain-specific flow
├── src/                 # Source code
│   ├── bot/             # Browser automation logic (Playwright wrapper)
│   ├── flow/            # Flow execution logic
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions (e.g., logging)
│   ├── db.ts            # SQLite database setup and operations
│   └── index.ts         # Main entry point, CLI setup
├── bookings.sqlite      # Local SQLite database file
├── package.json         # Project metadata and dependencies
├── bun.lockb            # Bun lockfile
├── tsconfig.json        # TypeScript configuration
└── README.md            # This file
```

## Getting Started

### Prerequisites

*   Bun installed ([Installation Guide](https://bun.sh/docs/installation))
*   Git

### Running Locally

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd langware-assignment
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    ```
3.  **Run the bot:**
    ```bash
    bun run src/index.ts <url> <name> <date> <time> <guests> [--ui]
    ```
    *   **`<url>`:** Full URL of the restaurant booking page.
    *   **`<name>`:** Name of the restaurant (used for logging).
    *   **`<date>`:** Desired date (YYYY-MM-DD).
    *   **`<time>`:** Desired time (HH:MM, 24-hour format).
    *   **`<guests>`:** Number of guests (positive integer).
    *   **`--ui` (Optional):** Runs the browser in non-headless mode so you can see the automation.

    **Example:**
    ```bash
    bun run src/index.ts "https://ontopo.com/en/us" "A Food Affair" "2025-05-20" "19:30" 2
    ```

## Flow Definitions (`flows/*.json`)

Flows define the sequence of actions the bot takes on a specific website. Each flow is a JSON object with:

*   `name`: A descriptive name for the flow.
*   `baseUrl`: (Optional) A base URL for the site.
*   `startStep`: The key of the first step to execute.
*   `headless`: (Optional) Boolean to suggest default headless mode (true/false). Overridden by `--ui` flag and constructor options.
*   `steps`: An object where keys are step names and values are step definitions.

Each **step definition** can include:

*   `description`: (Optional) What the step does.
*   `action`: The type of action (e.g., `navigate`, `click`, `type`, `checkElement`, `waitForSelector`).
*   `selector`: CSS selector for the target element.
*   `value`: Text to type (can use placeholders like `{{date}}`, `{{time}}`, `{{guests}}`).
*   `url`: URL for the `navigate` action.
*   `condition`: (Optional) A condition to check before executing the step (currently checks if an element exists).
*   `optional`: (Optional) Boolean; if true, the flow continues even if this step fails.
*   `waitForTime`: (Optional) Milliseconds to wait after the action.
*   `waitForNavigation`: (Optional) Boolean; wait for page navigation to complete after the action.
*   `nextStep`: The key of the next step to execute. If null or omitted on the last step, the flow ends.
