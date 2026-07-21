import { put, del } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { uploadsDir } from "@/db";

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveUpload(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (useBlob) {
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);
  return filename;
}

export async function deleteUpload(stored: string): Promise<void> {
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    if (useBlob) {
      try {
        await del(stored);
      } catch {
        // ignore missing blobs
      }
    }
    return;
  }

  const filePath = path.join(uploadsDir, stored);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function readUpload(stored: string): Promise<Buffer | null> {
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const res = await fetch(stored);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }

  const filePath = path.join(uploadsDir, stored);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function mediaUrl(stored: string): string {
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    return stored;
  }
  return `/api/media/${encodeURIComponent(stored)}`;
}
