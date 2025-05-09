import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";

const db = new Database("bookings.sqlite", { create: true });

export function initializeDb() {
	try {
		db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        guests INTEGER NOT NULL,
        status TEXT CHECK(status IN ('pending', 'found', 'not_found', 'error')) NOT NULL DEFAULT 'pending',
        options TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

		db.run(`
      CREATE TRIGGER IF NOT EXISTS update_bookings_updated_at
      AFTER UPDATE ON bookings FOR EACH ROW
      BEGIN
          UPDATE bookings SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
    `);

		console.log("Database initialized and bookings table ensured.");
	} catch (error) {
		console.error("Error initializing database:", error);
	}
}

export type BookingStatus = "pending" | "error" | "found" | "not-found";

export interface Booking {
	id: string;
	url: string;
	name: string;
	date: string;
	time: string;
	guests: number;
	status: BookingStatus;
	options?: string;
	created_at?: string;
	updated_at?: string;
}

export async function createBooking(
	url: string,
	name: string,
	date: string,
	time: string,
	guests: number,
	options?: string,
): Promise<string> {
	const id = randomUUID();
	const status: BookingStatus = "pending";
	try {
		const query = db.query(`
      INSERT INTO bookings (id, url, name, date, time, guests, status, options)
      VALUES ($id, $url, $name, $date, $time, $guests, $status, $options);
    `);
		query.run({
			$id: id,
			$url: url,
			$name: name,
			$date: date,
			$time: time,
			$guests: guests,
			$status: status,
			$options: options ?? null,
		});
		console.log(`Booking created with ID: ${id}`);
		return id;
	} catch (error) {
		console.error("Error creating booking:", error);
		throw error;
	}
}

export async function updateBookingStatus(
	id: string,
	status: BookingStatus,
): Promise<void> {
	try {
		const query = db.query(`
      UPDATE bookings
      SET status = $status
      WHERE id = $id;
    `);
		const result = query.run({ $id: id, $status: status });
		if (result) {
			console.log(`Booking status updated for ID: ${id} to ${status}`);
		} else {
			console.warn(
				`Booking status update might not have affected any rows for ID: ${id}`,
			);
		}
	} catch (error) {
		console.error(`Error updating booking status for ID ${id}:`, error);
		throw error;
	}
}

export function getBookingById(id: string): Booking | null {
	try {
		const query = db.query<Booking, { $id: string }>(`
            SELECT id, url, name, date, time, guests, status, options, created_at, updated_at
            FROM bookings
            WHERE id = $id;
        `);
		const booking = query.get({ $id: id });
		return booking ?? null;
	} catch (error) {
		console.error(`Error retrieving booking by ID ${id}:`, error);
		throw error;
	}
}

export default db;
