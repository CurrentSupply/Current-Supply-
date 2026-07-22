import {
  mapCategory,
  type Category,
  type CategoryRow,
} from "@/db/schema";
import {
  DEAL_PHOTOS_BUCKET,
  getServiceSupabase,
} from "@/lib/supabase";

const DEFAULT_CATEGORIES = [
  "Sneakers",
  "Apparel",
  "Electronics",
  "Accessories",
  "Other",
];

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
    // Bucket may already exist; uploads will surface real errors.
  }
}

async function bootstrap() {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("categories")
    .select("id,name,created_at")
    .limit(1);

  if (error) {
    throw new Error(
      `Supabase tables are missing or inaccessible (${error.message}). ` +
        `Open the SQL Editor and run supabase/migrations/001_init.sql, then retry.`,
    );
  }

  if (!data || data.length === 0) {
    const { error: seedError } = await supabase.from("categories").insert(
      DEFAULT_CATEGORIES.map((name) => ({ name })),
    );
    if (seedError && !seedError.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Could not seed categories: ${seedError.message}`);
    }
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

export async function listCategoryRows(): Promise<Category[]> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,created_at")
    .order("name");

  if (error) throw new Error(error.message);
  return ((data ?? []) as CategoryRow[]).map(mapCategory);
}

export { getServiceSupabase };
