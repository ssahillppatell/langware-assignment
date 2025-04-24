import { Database } from "bun:sqlite";
import { randomUUID } from 'crypto';

// Initialize the database
const db = new Database("bookings.sqlite", { create: true });

// Create the bookings table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    name TEXT,
    date TEXT,
    time TEXT,
    guests INTEGER,
    status TEXT CHECK(status IN ('pending', 'error', 'found', 'not-found')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Create a trigger to update updated_at on row update
db.run(`
    CREATE TRIGGER IF NOT EXISTS update_bookings_updated_at
    AFTER UPDATE ON bookings FOR EACH ROW
    BEGIN
        UPDATE bookings SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
`);

console.log("Database initialized and bookings table ensured.");

export type BookingStatus = 'pending' | 'error' | 'found' | 'not-found';

export interface Booking {
    id: string;
    name: string;
    date: string;
    time: string;
    guests: number;
    status: BookingStatus;
    created_at?: string; // Optional because DB defaults it
    updated_at?: string; // Optional because DB defaults/updates it
}

/**
 * Inserts a new booking record.
 * @param name - Name for the booking
 * @param date - Date of the booking
 * @param time - Time of the booking
 * @param guests - Number of guests
 * @returns The ID of the newly created booking.
 */
export async function createBooking(name: string, date: string, time: string, guests: number): Promise<string> {
    const id = randomUUID();
    const status: BookingStatus = 'pending';
    try {
        const query = db.query(`
      INSERT INTO bookings (id, name, date, time, guests, status)
      VALUES ($id, $name, $date, $time, $guests, $status);
    `);
        query.run({ $id: id, $name: name, $date: date, $time: time, $guests: guests, $status: status });
        console.log(`Booking created with ID: ${id}`);
        return id;
    } catch (error) {
        console.error("Error creating booking:", error);
        throw error; // Re-throw the error for the caller to handle
    }
}

/**
 * Updates the status of an existing booking.
 * @param id - The UUID of the booking to update.
 * @param status - The new status for the booking.
 */
export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
     try {
        const query = db.query(`
      UPDATE bookings
      SET status = $status
      WHERE id = $id;
    `);
        const result = query.run({ $id: id, $status: status });
        // Bun's run() return type doesn't directly expose changes,
        // but we can infer success if no error is thrown.
        if (result) { // Basic check if query execution object is returned
             console.log(`Booking status updated for ID: ${id} to ${status}`);
        } else {
             console.warn(`Booking status update might not have affected any rows for ID: ${id}`);
        }

    } catch (error) {
        console.error(`Error updating booking status for ID ${id}:`, error);
        throw error;
    }
}

/**
 * Retrieves a booking by its ID.
 * @param id - The UUID of the booking to retrieve.
 * @returns The booking object or null if not found.
 */
export function getBookingById(id: string): Booking | null { // Keep sync for now unless needed async
    try {
        const query = db.query<Booking, { $id: string }>(`
            SELECT id, name, date, time, guests, status, created_at, updated_at
            FROM bookings
            WHERE id = $id;
        `);
        const booking = query.get({ $id: id });
        return booking ?? null; // Return the found booking or null
    } catch (error) {
        console.error(`Error retrieving booking by ID ${id}:`, error);
        throw error; // Re-throw the error
    }
}


// Optional: Close the database connection when the application exits
// Note: Bun might handle this automatically, but explicit cleanup is good practice
// process.on('exit', () => db.close());

export default db; // Export the db instance if needed directly elsewhere
