import sharp from "sharp";
import { MAX_PHOTO_BYTES } from "@/lib/photoLimits";

const MAX_CANDIDATES = 16;
const MIN_BYTES = 4_000;
const MAX_EDGE = 1400;

export type FoundShoeImage = {
  buffer: Buffer;
  mimeType: string;
  sourceUrl: string;
  query: string;
};

type DdgImageResult = {
  image?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
};

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function buildQuery(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (/\b(sneaker|shoe|shoes|boot|boots)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} sneaker`;
}

function sniffsLikeImage(buffer: Buffer): boolean {
  if (buffer.byteLength < 12) return false;
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  // GIF
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return true;
  // WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  // AVIF / HEIC-ish (ISO BMFF with ftyp)
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") return true;
  return false;
}

async function fetchDuckDuckGoVqd(query: string): Promise<string> {
  const res = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
    },
  );
  if (!res.ok) {
    throw Object.assign(new Error("Image search failed to start."), {
      status: 502,
    });
  }
  const html = await res.text();
  const match =
    html.match(/vqd=["']([^"']+)["']/) ||
    html.match(/vqd=([\d-]+)/) ||
    html.match(/"vqd":"([^"]+)"/);
  if (!match?.[1]) {
    throw Object.assign(new Error("Image search is temporarily unavailable."), {
      status: 502,
    });
  }
  return match[1];
}

async function searchDuckDuckGoImages(
  query: string,
): Promise<Array<{ url: string; width: number; height: number }>> {
  const vqd = await fetchDuckDuckGoVqd(query);
  const res = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`,
    {
      headers: {
        Referer: "https://duckduckgo.com/",
        "User-Agent": BROWSER_UA,
        Accept: "application/json,text/javascript,*/*",
      },
    },
  );
  if (!res.ok) {
    throw Object.assign(new Error("Image search request failed."), {
      status: 502,
    });
  }

  const data = (await res.json()) as { results?: DdgImageResult[] };
  const ranked = (data.results ?? [])
    .map((row) => {
      const url = String(row.image ?? "").trim();
      const width = Number(row.width) || 0;
      const height = Number(row.height) || 0;
      return { url, width, height, area: width * height };
    })
    .filter((row) => row.url.startsWith("http"))
    // Prefer larger product shots over tiny thumbs / banners.
    .sort((a, b) => b.area - a.area);

  const urls: Array<{ url: string; width: number; height: number }> = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    urls.push(row);
    if (urls.length >= MAX_CANDIDATES) break;
  }

  // Reliable Bing CDN thumbnails as last-resort fallbacks.
  for (const row of data.results ?? []) {
    const thumb = String(row.thumbnail ?? "").trim();
    if (!thumb.startsWith("http") || seen.has(thumb)) continue;
    seen.add(thumb);
    urls.push({
      url: thumb,
      width: Number(row.width) || 0,
      height: Number(row.height) || 0,
    });
    if (urls.length >= MAX_CANDIDATES + 8) break;
  }

  return urls;
}

async function downloadCandidate(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://www.google.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    // Bot walls often return HTML with a 200.
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < MIN_BYTES || buffer.byteLength > MAX_PHOTO_BYTES) {
      return null;
    }
    if (!sniffsLikeImage(buffer)) return null;
    return buffer;
  } catch {
    return null;
  }
}

async function toCoverJpeg(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

/** Find a product-style image for a deal title (no uploaded photo). */
export async function findShoeImageFromTitle(
  name: string,
): Promise<FoundShoeImage> {
  const query = buildQuery(name);
  if (!query) {
    throw Object.assign(new Error("Enter an item name first."), {
      status: 400,
    });
  }

  const candidates = await searchDuckDuckGoImages(query);
  if (candidates.length === 0) {
    throw Object.assign(
      new Error("No photos found for that name. Try a clearer product title."),
      { status: 404 },
    );
  }

  let lastDecodeError = "";
  for (const candidate of candidates) {
    const raw = await downloadCandidate(candidate.url);
    if (!raw) continue;
    try {
      const jpeg = await toCoverJpeg(raw);
      if (jpeg.byteLength < MIN_BYTES || jpeg.byteLength > MAX_PHOTO_BYTES) {
        continue;
      }
      return {
        buffer: jpeg,
        mimeType: "image/jpeg",
        sourceUrl: candidate.url,
        query,
      };
    } catch (err) {
      lastDecodeError =
        err instanceof Error ? err.message : "Could not decode image.";
    }
  }

  throw Object.assign(
    new Error(
      lastDecodeError
        ? "Found images, but none could be converted for cover use. Try again or upload a photo."
        : "Found image links, but none could be downloaded. Try again or upload a photo.",
    ),
    { status: 502 },
  );
}
