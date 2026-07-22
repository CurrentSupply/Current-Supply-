import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";
import { categories } from "./schema";
import {
  DEAL_PHOTOS_BUCKET,
  getDatabaseUrl,
  getServiceSupabase,
} from "@/lib/supabase";

type Db = PostgresJsDatabase<typeof schema>;

let sqlClient: Sql | null = null;
let dbInstance: Db | null = null;

function getSql(): Sql {
  if (!sqlClient) {
    sqlClient = postgres(getDatabaseUrl(), {
      prepare: false,
      max: 10,
    });
  }
  return sqlClient;
}

function getDb(): Db {
  if (!dbInstance) {
    dbInstance = drizzle(getSql(), { schema });
  }
  return dbInstance;
}

/** Lazy Drizzle client — resolves DATABASE_URL on first use. */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureStorageBucket() {
  try {
    const supabase = getServiceSupabase();
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === DEAL_PHOTOS_BUCKET);
    if (!exists) {
      await supabase.storage.createBucket(DEAL_PHOTOS_BUCKET, {
        public: true,
        fileSizeLimit: 8 * 1024 * 1024,
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ],
      });
    }
  } catch {
    // Bucket may already exist or keys not set yet; uploads will surface errors.
  }
}

async function bootstrap() {
  const client = getSql();

  await client`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS deals (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      cost DOUBLE PRECISION NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      condition TEXT NOT NULL DEFAULT '',
      category_id INTEGER REFERENCES categories(id),
      status TEXT NOT NULL DEFAULT 'in_stock',
      owner TEXT NOT NULL DEFAULT 'other',
      purchased_at TEXT NOT NULL,
      sold_at TEXT,
      notes TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      is_cover BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const countResult = await client`SELECT COUNT(*)::int AS c FROM categories`;
  const count = Number(countResult[0]?.c ?? 0);

  if (count === 0) {
    await getDb().insert(categories).values([
      { name: "Sneakers" },
      { name: "Apparel" },
      { name: "Electronics" },
      { name: "Accessories" },
      { name: "Other" },
    ]);
  }

  await ensureStorageBucket();
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
