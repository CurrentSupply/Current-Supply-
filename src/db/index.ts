import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
const uploadsDir = path.join(process.cwd(), "public", "uploads");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, "reselling.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

let initialized = false;

export function ensureDb() {
  if (initialized) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      cost REAL NOT NULL,
      price REAL NOT NULL,
      condition TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'in_stock',
      purchased_at TEXT NOT NULL,
      sold_at TEXT,
      notes TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      is_cover INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const count = sqlite
    .prepare("SELECT COUNT(*) as c FROM categories")
    .get() as { c: number };

  if (count.c === 0) {
    const insert = sqlite.prepare("INSERT INTO categories (name) VALUES (?)");
    for (const name of [
      "Sneakers",
      "Apparel",
      "Electronics",
      "Accessories",
      "Other",
    ]) {
      insert.run(name);
    }
  }

  initialized = true;
}

export { uploadsDir };
