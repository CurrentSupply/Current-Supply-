type ErrorBody = { error?: string };

function errorMessage(data: unknown, fallback: string): string {
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as ErrorBody).error === "string" &&
    (data as ErrorBody).error
  ) {
    return (data as ErrorBody).error!;
  }
  return fallback;
}

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

/** Fetch JSON and throw with the server `{ error }` message when not ok. */
export async function apiFetch<T>(
  url: string,
  init?: RequestInit,
  fallbackError = "Request failed.",
): Promise<T> {
  const res = await fetch(url, init);
  const data = await readJson<T | ErrorBody>(res);
  if (!res.ok) {
    throw new Error(errorMessage(data, `${fallbackError} (${res.status})`));
  }
  return data as T;
}

export function getJson<T>(url: string, fallbackError?: string): Promise<T> {
  return apiFetch<T>(url, undefined, fallbackError);
}

export function postJson<T>(
  url: string,
  body: unknown,
  fallbackError?: string,
): Promise<T> {
  return apiFetch<T>(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fallbackError,
  );
}

export function patchJson<T>(
  url: string,
  body: unknown,
  fallbackError?: string,
): Promise<T> {
  return apiFetch<T>(
    url,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    fallbackError,
  );
}

export function deleteJson<T = unknown>(
  url: string,
  fallbackError?: string,
): Promise<T> {
  return apiFetch<T>(url, { method: "DELETE" }, fallbackError);
}
