import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

const MAX_CANDIDATES = 10;
const MIN_BYTES = 4_000;

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

function buildQuery(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (/\b(sneaker|shoe|shoes|boot|boots)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} sneaker`;
}

async function fetchDuckDuckGoVqd(query: string): Promise<string> {
  const res = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CurrentSupply/1.0; +https://current-supply)",
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

async function searchDuckDuckGoImages(query: string): Promise<string[]> {
  const vqd = await fetchDuckDuckGoVqd(query);
  const res = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&f=,,,,,&p=1`,
    {
      headers: {
        Referer: "https://duckduckgo.com/",
        "User-Agent":
          "Mozilla/5.0 (compatible; CurrentSupply/1.0; +https://current-supply)",
      },
    },
  );
  if (!res.ok) {
    throw Object.assign(new Error("Image search request failed."), {
      status: 502,
    });
  }

  const data = (await res.json()) as { results?: DdgImageResult[] };
  const urls: string[] = [];
  for (const row of data.results ?? []) {
    const image = String(row.image ?? "").trim();
    if (!image.startsWith("http")) continue;
    if (urls.includes(image)) continue;
    urls.push(image);
    if (urls.length >= MAX_CANDIDATES) break;
  }
  return urls;
}

function normalizeMime(raw: string | null, url: string): string | null {
  const mime = (raw || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(mime)) return mime;
  const lower = url.toLowerCase();
  if (/\.(png)(\?|$)/.test(lower)) return "image/png";
  if (/\.(webp)(\?|$)/.test(lower)) return "image/webp";
  if (/\.(gif)(\?|$)/.test(lower)) return "image/gif";
  if (/\.(jpe?g)(\?|$)/.test(lower)) return "image/jpeg";
  return null;
}

async function downloadCandidate(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
} | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CurrentSupply/1.0; +https://current-supply)",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const mimeType = normalizeMime(res.headers.get("content-type"), url);
    if (!mimeType) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < MIN_BYTES || buffer.byteLength > MAX_PHOTO_BYTES) {
      return null;
    }
    return { buffer, mimeType };
  } catch {
    return null;
  }
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

  for (const sourceUrl of candidates) {
    const downloaded = await downloadCandidate(sourceUrl);
    if (!downloaded) continue;
    return {
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType,
      sourceUrl,
      query,
    };
  }

  throw Object.assign(
    new Error(
      "Found image links, but none could be downloaded. Try again or upload a photo.",
    ),
    { status: 502 },
  );
}
