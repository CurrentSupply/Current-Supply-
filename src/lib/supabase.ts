import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const DEAL_PHOTOS_BUCKET = "deal-photos";

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
