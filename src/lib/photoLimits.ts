export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Soft limit shown to users; enforced before signing / register. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function extForContentType(contentType: string, originalName: string): string {
  const fromName = originalName.includes(".")
    ? originalName.slice(originalName.lastIndexOf(".")).toLowerCase()
    : "";
  if (fromName && /^\.(jpe?g|png|webp|gif)$/.test(fromName)) return fromName;
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return ".jpg";
  }
}
