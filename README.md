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
*   **Date Handling:** Day.js
*   **Logging:** Consola, Chalk

## Project Structure

```
/langware-assignment
├── flows/                  # JSON definitions for website interaction flows
│   ├── default.json
│   └── ontopo.com.json     # Flow with custom date/time formats
├── src/
│   ├── bot/                # Core browser automation logic
│   │   └── browser.ts
│   ├── db/                 # Database interaction logic
│   │   └── index.ts
│   ├── flow/               # Flow execution logic
│   │   └── executor.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── booking.ts
│   │   └── flow.ts         # Includes dateFormat and timeFormat properties
│   ├── ui/                 # Static files for the web UI
│   │   ├── index.html
│   │   ├── script.js
│   │   └── style.css
│   ├── utils/              # Utility functions
│   │   ├── date.ts         # Date/time formatting and validation
│   │   └── log.ts          # Logging utilities
│   ├── index.ts            # Main entry point (CLI argument parsing, starts bot/server)
│   └── server.ts           # Bun web server for the UI mode
├── .gitignore
├── bookings.sqlite         # SQLite database file (created on first run)
├── bun.lock
├── package.json
├── README.md
└── tsconfig.json
```

## Database

Booking attempts and their final status are logged in a local SQLite database file named `bookings.sqlite`, created in the project root directory.

**`bookings` Table Schema:**

| Column      | Type      | Description                                                                 |
| :---------- | :-------- | :-------------------------------------------------------------------------- |
| `id`        | `TEXT`    | Primary Key (UUID)                                                          |
| `url`       | `TEXT`    | The booking URL provided by the user                                        |
| `name`      | `TEXT`    | The restaurant name provided by the user                                    |
| `date`      | `TEXT`    | The requested date (format depends on flow definition, e.g., "Saturday, April 26" for ontopo.com) |
| `time`      | `TEXT`    | The requested time (format depends on flow definition, e.g., "08:00 PM" for ontopo.com) |
| `guests`    | `INTEGER` | The requested number of guests                                              |
| `status`    | `TEXT`    | Final status: 'pending', 'found', 'error'                                   |
| `options`   | `TEXT`    | JSON string storing run options (e.g., `{"headless":true,"mode":"cli"}`) |
| `created_at`| `DATETIME`| Timestamp when the record was created                                       |
| `updated_at`| `DATETIME`| Timestamp when the record was last updated (status change)                  |

## Getting Started

### Prerequisites

*   Bun installed ([Installation Guide](https://bun.sh/docs/installation))
*   Git
*   Playwright installed via `bunx playwright install chromium` (for Chromium browser support)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/ssahillppatell/langware-assignment.git
   cd langware-assignment
   ```

2. Install dependencies
   ```bash
   bun install
   ```

3. Install Playwright browsers
   ```bash
   bunx playwright install chromium
   ```
   Note: The bot uses Chromium by default. If you want to use a different browser, you'll need to modify the code.

### Running the Bot

There are two ways to run the bot:

1.  **Command Line Interface (CLI):**
	    *   Provide all booking details as command-line arguments.
	    *   Arguments are required unless using the `--ui` flag.

    ```bash
    bun run src/index.ts [url] [name] [date] [time] [guests] [--no-headless]
    ```
    *   **`[url]`:** Full URL of the restaurant booking page.
    *   **`[name]`:** Name of the restaurant (used for logging).
    *   **`[date]`:** Desired date (YYYY-MM-DD format is recommended for CLI input).
    *   **`[time]`:** Desired time (HH:MM, 24-hour format is recommended for CLI input).
   
   Note: The date and time will be automatically formatted according to the website's requirements as defined in the flow file. For example, ontopo.com requires dates in the format "Saturday, April 26" and times in the format "08:00 PM".
    *   **`[guests]`:** Number of guests (positive integer).
    *   **`--no-headless` (Optional):** Runs with a visible browser window. If omitted, runs in headless mode by default.

	    **Example (CLI):**
	    ```bash
	    bun run src/index.ts https://ontopo.com/en/us "Food" "2025-04-26" "19:00" 2
	    ```

2.  **Web User Interface (UI):**
    *   Launches a simple web interface where you can enter booking details in a form.
    *   Uses a visible browser (non-headless) for the bot execution by default when initiated from the UI.

    ```bash
    bun run src/index.ts --ui
    ```
    *   This command starts a web server, typically on `http://localhost:3000` (check console output for the exact URL).
    *   Open the URL in your web browser.
    *   Fill in the form fields (URL, Name, Date, Time, Guests) and click "Find Tables".
    *   The result (success or error message) will be displayed on the web page.

## Flow Definitions (`flows/*.json`)

Flows define the sequence of actions the bot takes on a specific website. Each flow is a JSON object with:

*   `name`: A descriptive name for the flow.
*   `baseUrl`: (Optional) A base URL for the site.
*   `startStep`: The key of the first step to execute.
*   `headless`: (Optional) Boolean to suggest default headless mode (true/false). Overridden by `--no-headless` flag and constructor options.
*   `dateFormat`: The date format required by the website, using dayjs format specifiers (e.g., "dddd, MMMM D" for "Saturday, April 26").
*   `timeFormat`: The time format required by the website, using dayjs format specifiers (e.g., "hh:mm A" for "08:00 PM").
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
