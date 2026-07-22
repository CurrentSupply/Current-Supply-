export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.ok
        ? "Empty response from server."
        : `Server error (${res.status}). Check Supabase setup — run supabase/migrations/001_init.sql in the SQL Editor if tables are missing.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Server returned invalid JSON (${res.status}): ${text.slice(0, 160)}`,
    );
  }
}
