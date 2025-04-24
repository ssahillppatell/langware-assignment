import { Database } from "bun:sqlite";
import { randomUUID } from 'crypto';

const db = new Database("bookings.sqlite", { create: true });

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
    created_at?: string; 
    updated_at?: string; 
}

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
        throw error; 
    }
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
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
             console.warn(`Booking status update might not have affected any rows for ID: ${id}`);
        }

    } catch (error) {
        console.error(`Error updating booking status for ID ${id}:`, error);
        throw error;
    }
}

export function getBookingById(id: string): Booking | null { 
    try {
        const query = db.query<Booking, { $id: string }>(`
            SELECT id, name, date, time, guests, status, created_at, updated_at
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
