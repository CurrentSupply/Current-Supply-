/** Resize/compress large images in the browser before Storage upload. */
export async function compressImage(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  const maxEdge = options.maxEdge ?? 2000;
  const quality = options.quality ?? 0.85;

  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  // Already small and under ~1.5MB — skip re-encode.
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, outW, outH);
  bitmap.close();

  const preferJpeg = file.type === "image/jpeg" || file.type === "image/webp";
  const mime = preferJpeg || file.type === "image/png" ? "image/jpeg" : file.type;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mime, quality);
  });

  if (!blob || blob.size >= file.size) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  const name = mime === "image/jpeg" ? `${base}.jpg` : file.name;
  return new File([blob], name, { type: mime, lastModified: Date.now() });
}
