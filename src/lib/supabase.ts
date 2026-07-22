import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DEAL_PHOTOS_BUCKET = "deal-photos";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local (local) or Vercel env (production).`,
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://onjguvlozsqxkurgqgbl.supabase.co"
  );
}

/** Server client with service role — bypasses RLS for this single-user app. */
export function getServiceSupabase(): SupabaseClient {
  const url = getSupabaseUrl();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Copy it from Supabase → Project Settings → API.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getDatabaseUrl(): string {
  return requireEnv("DATABASE_URL");
}
