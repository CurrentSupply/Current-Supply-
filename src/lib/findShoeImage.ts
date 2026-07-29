import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

const MAX_CANDIDATES = 12;
const MIN_BYTES = 4_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

type ImageSearchProvider = (query: string) => Promise<string[]>;

function buildQuery(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (/\b(sneaker|shoe|shoes|boot|boots)\b/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} sneaker`;
}

function uniqueHttpUrls(urls: string[], limit = MAX_CANDIDATES): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const url = String(raw ?? "").trim();
    if (!url.startsWith("http")) continue;
    if (out.includes(url)) continue;
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

function extractVqd(html: string): string | null {
  const match =
    html.match(/vqd=["']([^"']+)["']/) ||
    html.match(/name=["']vqd["']\s+value=["']([^"']+)["']/) ||
    html.match(/value=["']([^"']+)["']\s+name=["']vqd["']/) ||
    html.match(/"vqd":"([^"]+)"/) ||
    html.match(/vqd=([\d-]+)/);
  return match?.[1] ?? null;
}

function cookieHeader(res: Response): string | undefined {
  const anyHeaders = res.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : [];
  if (!setCookies.length) {
    const single = res.headers.get("set-cookie");
    if (!single) return undefined;
    return single.split(";")[0];
  }
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

async function fetchDuckDuckGoVqd(
  query: string,
): Promise<{ vqd: string; cookie?: string } | null> {
  const encoded = encodeURIComponent(query);
  const pages = [
    `https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`,
    `https://html.duckduckgo.com/html/?q=${encoded}`,
    `https://lite.duckduckgo.com/lite/?q=${encoded}`,
    `https://duckduckgo.com/?q=${encoded}`,
  ];

  for (const page of pages) {
    try {
      const res = await fetch(page, {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const vqd = extractVqd(html);
      if (!vqd) continue;
      return { vqd, cookie: cookieHeader(res) };
    } catch {
      // try next page
    }
  }
  return null;
}

async function searchDuckDuckGoImages(query: string): Promise<string[]> {
  const token = await fetchDuckDuckGoVqd(query);
  if (!token) return [];

  const res = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(token.vqd)}&f=,,,,,&p=1`,
    {
      headers: {
        Referer: "https://duckduckgo.com/",
        "User-Agent": BROWSER_UA,
        Accept: "application/json,text/javascript,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(token.cookie ? { Cookie: token.cookie } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as { results?: DdgImageResult[] };
  return uniqueHttpUrls(
    (data.results ?? []).map((row) => String(row.image ?? "")),
  );
}

/** Reliable on serverless: Bing returns a JPEG for the query itself. */
async function searchBingThumbnail(query: string): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  return [
    `https://www.bing.com/th?q=${encoded}&w=1200&h=1200&c=7&rs=1&p=0&dpr=1&pid=1.7`,
    `https://tse1.mm.bing.net/th?q=${encoded}&w=1200&h=1200&c=7&rs=1&p=0&dpr=1&pid=1.7`,
    `https://tse2.mm.bing.net/th?q=${encoded}&w=1000&h=1000&c=7&rs=1&p=0&dpr=1&pid=1.7`,
  ];
}

async function searchBingImagesHtml(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=0&count=35&mmasync=1`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://www.bing.com/images/search",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const encoded = Array.from(
      html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g),
    ).map((m) => m[1]);
    const decoded = encoded.map((u) => {
      try {
        return decodeURIComponent(u);
      } catch {
        return u;
      }
    });
    return uniqueHttpUrls(decoded);
  } catch {
    return [];
  }
}

async function searchOpenverseImages(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${MAX_CANDIDATES}`,
      {
        headers: {
          "User-Agent": "CurrentSupply/1.0 (inventory; find cover photo)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ url?: string; thumbnail?: string }>;
    };
    return uniqueHttpUrls(
      (data.results ?? []).flatMap((row) => [
        String(row.url ?? ""),
        String(row.thumbnail ?? ""),
      ]),
    );
  } catch {
    return [];
  }
}

function normalizeMime(raw: string | null, url: string): string | null {
  const mime = (raw || "").split(";")[0].trim().toLowerCase();
  if (ALLOWED_IMAGE_TYPES.has(mime)) return mime;
  // Bing thumbnail endpoints often omit a useful extension.
  if (/bing\.com\/th\?/i.test(url) || /mm\.bing\.net\/th\?/i.test(url)) {
    return "image/jpeg";
  }
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
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://www.bing.com/",
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

const PROVIDERS: ImageSearchProvider[] = [
  searchDuckDuckGoImages,
  searchBingThumbnail,
  searchBingImagesHtml,
  searchOpenverseImages,
];

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

  let sawLinks = false;
  for (const provider of PROVIDERS) {
    let candidates: string[] = [];
    try {
      candidates = await provider(query);
    } catch {
      continue;
    }
    if (!candidates.length) continue;
    sawLinks = true;

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
  }

  if (!sawLinks) {
    throw Object.assign(
      new Error("No photos found for that name. Try a clearer product title."),
      { status: 404 },
    );
  }

  throw Object.assign(
    new Error(
      "Found image links, but none could be downloaded. Try again or upload a photo.",
    ),
    { status: 502 },
  );
}
