import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import fs from "fs";
import path from "path";
import * as schema from "./schema";
import { categories } from "./schema";

const isVercel = Boolean(process.env.VERCEL);

const dataDir = path.join(process.cwd(), "data");
const localUploadsDir = path.join(process.cwd(), "public", "uploads");
const vercelUploadsDir = path.join("/tmp", "uploads");

export const uploadsDir = isVercel ? vercelUploadsDir : localUploadsDir;

function resolveDbUrl(): string {
  if (process.env.TURSO_DATABASE_URL) {
    return process.env.TURSO_DATABASE_URL;
  }
  if (isVercel) {
    return "file:/tmp/reselling.db";
  }
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbFile = path.join(dataDir, "reselling.db");
  // libSQL expects a file: URL; normalize Windows paths
  return `file:${dbFile.replaceAll("\\", "/")}`;
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const client: Client = createClient({
  url: resolveDbUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

let initialized = false;
let initPromise: Promise<void> | null = null;

async function bootstrap() {
  await client.executeMultiple(`
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

  const countResult = await client.execute(
    "SELECT COUNT(*) as c FROM categories",
  );
  const count = Number(countResult.rows[0]?.c ?? 0);

  if (count === 0) {
    await db.insert(categories).values([
      { name: "Sneakers" },
      { name: "Apparel" },
      { name: "Electronics" },
      { name: "Accessories" },
      { name: "Other" },
    ]);
  }
}

export async function ensureDb() {
  if (initialized) return;
  if (!initPromise) {
    initPromise = bootstrap()
      .then(() => {
        initialized = true;
      })
      .catch((err) => {
        initPromise = null;
        throw err;
      });
  }
  await initPromise;
}
