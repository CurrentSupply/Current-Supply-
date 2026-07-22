import {
  DEAL_PHOTOS_BUCKET,
  getServiceSupabase,
} from "@/lib/supabase";

function storagePathFromStored(stored: string): string | null {
  if (!stored) return null;
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const marker = `/storage/v1/object/public/${DEAL_PHOTOS_BUCKET}/`;
    const idx = stored.indexOf(marker);
    if (idx >= 0) return stored.slice(idx + marker.length);
    return null;
  }
  return stored.replace(/^\/+/, "");
}

export async function saveUpload(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = getServiceSupabase();
  const path = filename.replace(/^\/+/, "");

  const { error } = await supabase.storage
    .from(DEAL_PHOTOS_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(DEAL_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteUpload(stored: string): Promise<void> {
  const path = storagePathFromStored(stored);
  if (!path) return;

  try {
    const supabase = getServiceSupabase();
    await supabase.storage.from(DEAL_PHOTOS_BUCKET).remove([path]);
  } catch {
    // ignore missing objects
  }
}

export async function readUpload(stored: string): Promise<Buffer | null> {
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const res = await fetch(stored);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from(DEAL_PHOTOS_BUCKET)
      .download(stored.replace(/^\/+/, ""));
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  } catch {
    return null;
  }
}
