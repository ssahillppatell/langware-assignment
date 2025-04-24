import path from "node:path";
import type { ServeOptions, Server } from "bun";
import type { BotRunOptions } from "./index";
import type { BookingDetails } from "./types/booking";
import { log } from "./utils/log";

type RunBotTaskFn = (
	bookingDetails: BookingDetails,
	opts: BotRunOptions,
) => Promise<{ success: boolean; message: string }>;

let serverInstance: Server | null = null;
let serverRunOptions: BotRunOptions | null = null;

export async function startServer(
	runBotTask: RunBotTaskFn,
	initialOptions: BotRunOptions,
) {
	if (serverInstance) {
		log.warn("Server already running.");
		return;
	}

	serverRunOptions = initialOptions;
	log.info(
		`Server started with initial options: ${JSON.stringify(serverRunOptions)}`,
	);

	const uiDir = path.join(process.cwd(), "src/ui");

	const serverOptions: ServeOptions = {
		port: 3000,
		async fetch(req) {
			const url = new URL(req.url);
			log.debug(`[Server] Received request: ${req.method} ${url.pathname}`);

			try {
				if (req.method === "GET") {
					let filePath = "";
					if (url.pathname === "/") {
						filePath = path.join(uiDir, "index.html");
					} else if (url.pathname === "/style.css") {
						filePath = path.join(uiDir, "style.css");
					} else if (url.pathname === "/script.js") {
						filePath = path.join(uiDir, "script.js");
					}

					if (filePath) {
						const file = Bun.file(filePath);
						if (await file.exists()) {
							log.debug(`[Server] Serving file: ${filePath}`);
							return new Response(file);
						}
						log.error(`[Server] File not found: ${filePath}`);
						return new Response("Not Found", { status: 404 });
					}
				}

				if (req.method === "POST" && url.pathname === "/run-bot") {
					log.info("[Server] Received /run-bot request");
					const data = (await req.json()) as {
						url: string;
						name: string;
						date: string;
						time: string;
						guests: string;
					};

					if (
						!data.url ||
						!data.name ||
						!data.date ||
						!data.time ||
						!data.guests
					) {
						log.error("[Server] Invalid input data:", data);
						return new Response(
							JSON.stringify({
								success: false,
								message: "Missing required fields.",
							}),
							{
								status: 400,
								headers: { "Content-Type": "application/json" },
							},
						);
					}

					const bookingDetails: BookingDetails = {
						url: data.url,
						name: data.name,
						date: data.date,
						time: data.time,
						guests: Number.parseInt(data.guests, 10),
					};

					const taskOptions: BotRunOptions = {
						mode: "ui",
						headless: false,
					};

					log.info(
						`[Server] Calling runBotTask with options: ${JSON.stringify(taskOptions)}`,
					);
					const result = await runBotTask(bookingDetails, taskOptions);
					log.info("[Server] runBotTask completed, result:", result.message);

					return new Response(JSON.stringify(result), {
						headers: { "Content-Type": "application/json" },
					});
				}

				log.warn(`[Server] Unhandled route: ${req.method} ${url.pathname}`);
				return new Response("Not Found", { status: 404 });
			} catch (error) {
				log.error("[Server] Error processing request:", error);
				return new Response(
					JSON.stringify({ success: false, message: "Internal Server Error" }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
		},
		error(error) {
			log.error("[Server] Uncaught server error:", error);
			return new Response("Internal Server Error", { status: 500 });
		},
	};

	try {
		serverInstance = Bun.serve(serverOptions);
		log.success(`Server listening on http://localhost:${serverOptions.port}`);
	} catch (e) {
		log.error("Failed to start server:", e);
		throw e;
	}
}

export function stopServer() {
	if (serverInstance) {
		serverInstance.stop();
		serverInstance = null;
		log.info("Server stopped.");
	} else {
		log.warn("Server is not running.");
	}
}

process.on("SIGINT", () => {
	log.info("SIGINT signal received. Stopping server...");
	stopServer();
	process.exit(0);
});
process.on("SIGTERM", () => {
	log.info("SIGTERM signal received. Stopping server...");
	stopServer();
	process.exit(0);
});
