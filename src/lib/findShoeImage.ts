import sharp from "sharp";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

const MAX_CANDIDATES = 16;
const MIN_BYTES = 8_000;
const MIN_EDGE = 700;
const TARGET_WIDTH = 1600;
const TARGET_HEIGHT = 1200;
const CONTENT_PAD = 0.06;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CATALOG_HOST_SCORE: Array<{ test: RegExp; score: number }> = [
  { test: /images\.stockx\.com/i, score: 100 },
  { test: /image\.goat\.com/i, score: 95 },
  { test: /static\.nike\.com/i, score: 90 },
  { test: /assets\.adidas\.com|adidas\.com\/.*media/i, score: 85 },
  { test: /sneakernews\.com|hypebeast\.com|nicekicks\.com/i, score: 70 },
  { test: /bing\.com\/th|mm\.bing\.net\/th/i, score: -80 },
];

export type FoundShoeImage = {
  buffer: Buffer;
  mimeType: string;
  sourceUrl: string;
  query: string;
};

type ImageCandidate = {
  url: string;
  width?: number;
  height?: number;
  title?: string;
  score?: number;
};

type DdgImageResult = {
  image?: string;
  thumbnail?: string;
  title?: string;
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

function uniqueCandidates(
  rows: ImageCandidate[],
  limit = MAX_CANDIDATES,
): ImageCandidate[] {
  const out: ImageCandidate[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const url = String(row.url ?? "").trim();
    if (!url.startsWith("http")) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ ...row, url });
    if (out.length >= limit) break;
  }
  return out;
}

function hostScore(url: string): number {
  for (const rule of CATALOG_HOST_SCORE) {
    if (rule.test.test(url)) return rule.score;
  }
  return 0;
}

function rankCandidates(rows: ImageCandidate[]): ImageCandidate[] {
  return rows
    .map((row) => {
      const area =
        row.width && row.height ? row.width * row.height : 640 * 480;
      let score =
        (row.score ?? 0) + hostScore(row.url) + Math.min(area / 20_000, 80);
      if (isLifestyleShot(row)) score -= 120;
      if (/product|catalog|pdp/i.test(`${row.url} ${row.title ?? ""}`)) {
        score += 25;
      }
      return { ...row, score };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
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

function upgradeStockXImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!/images\.stockx\.com$/i.test(parsed.hostname)) return url;
    // Official StockX product plate is 700×500 @ dpr=2 → crisp 1400×1000.
    parsed.searchParams.set("fit", "fill");
    parsed.searchParams.set("bg", "FFFFFF");
    parsed.searchParams.set("w", "700");
    parsed.searchParams.set("h", "500");
    parsed.searchParams.set("fm", "jpg");
    parsed.searchParams.set("q", "90");
    parsed.searchParams.set("dpr", "2");
    parsed.searchParams.set("trim", "color");
    parsed.searchParams.set("auto", "compress");
    return parsed.toString();
  } catch {
    return url;
  }
}

function isLifestyleShot(candidate: ImageCandidate): boolean {
  const hay = `${candidate.url} ${candidate.title ?? ""}`.toLowerCase();
  return (
    /on[-_]?feet|onfeet|worn|street[- ]?style|outfit|sizing|review|unboxing|closet|feet/.test(
      hay,
    ) || /wp-content\/uploads\/.*on-feet/i.test(candidate.url)
  );
}

function slugToStockXProductFile(slug: string): string {
  const acronyms = new Set([
    "og",
    "sb",
    "sp",
    "qs",
    "se",
    "nrg",
    "mmm",
    "pe",
    "lw",
    "prm",
    "tr",
    "td",
    "ps",
    "gp",
  ]);
  const parts = slug.split("-").filter(Boolean).map((part) => {
    if (acronyms.has(part.toLowerCase())) return part.toUpperCase();
    if (/^\d+$/.test(part)) return part;
    return part.charAt(0).toUpperCase() + part.slice(1);
  });
  return `${parts.join("-")}-Product.jpg`;
}

/** Expand short reseller nicknames into searchable product titles. */
function expandSearchQueries(name: string): string[] {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const out: string[] = [trimmed];

  if (/^volt\s*6\b/.test(lower) || /\bjordan\s*6\s*volt\b/.test(lower)) {
    out.push(
      "Air Jordan 6 Retro Electric Green",
      "Jordan 6 Retro Electric Green",
    );
  }
  if (/\bpanda\b/.test(lower) && /\bdunk\b/.test(lower)) {
    out.push("Nike Dunk Low Retro White Black");
  }
  if (
    /^chicago\s*1\b/.test(lower) ||
    /\bjordan\s*1\s*(retro\s*)?(high\s*)?chicago\b/.test(lower)
  ) {
    out.push("Air Jordan 1 Retro High OG Chicago");
  }

  // "volt 6" / "bred 4" style: colorway + model number
  const colorModel = lower.match(
    /^([a-z][a-z0-9-]*)\s+(\d{1,2})(?:\s|$)/,
  );
  if (
    colorModel &&
    !/\b(jordan|nike|adidas|yeezy|new balance|asics|dunk)\b/.test(lower)
  ) {
    const color = colorModel[1];
    const model = colorModel[2];
    out.push(
      `Air Jordan ${model} Retro ${color}`,
      `Jordan ${model} Retro ${color}`,
      `Air Jordan ${model} ${color}`,
    );
  }

  if (
    /^\d+\b/.test(lower) &&
    !/\b(jordan|nike|adidas|yeezy|new balance)\b/.test(lower)
  ) {
    out.push(`Air Jordan ${trimmed}`, `Jordan ${trimmed}`);
  }

  return Array.from(new Set(out));
}

/**
 * Guess StockX CDN product plates directly from the title.
 * Works even when DuckDuckGo/Bing web search are blocked on Vercel.
 */
function guessStockXProductCandidates(query: string): ImageCandidate[] {
  const year = new Date().getUTCFullYear();
  const years = ["", `-${year}`, `-${year - 1}`, `-${year - 2}`, "-2021"];
  const bases = new Set<string>();

  for (const expanded of expandSearchQueries(query)) {
    const slug = expanded
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) continue;
    bases.add(slug);
    if (!slug.startsWith("air-")) bases.add(`air-${slug}`);
    if (/^jordan-\d+/.test(slug) && !slug.includes("retro")) {
      bases.add(slug.replace(/^(jordan-\d+)/, "$1-retro"));
      bases.add(`air-${slug.replace(/^(jordan-\d+)/, "$1-retro")}`);
    }
    if (/dunk-low/.test(slug) && !slug.includes("retro")) {
      bases.add(slug.replace("dunk-low", "dunk-low-retro"));
    }
    if (/panda/.test(slug) && /dunk/.test(slug)) {
      bases.add("nike-dunk-low-retro-white-black");
    }
  }

  const out: ImageCandidate[] = [];
  for (const base of bases) {
    for (const suffix of years) {
      const file = slugToStockXProductFile(`${base}${suffix}`);
      out.push({
        url: upgradeStockXImageUrl(`https://images.stockx.com/images/${file}`),
        width: 1400,
        height: 1000,
        title: `${base} product`,
        score: 160,
      });
    }
  }
  return uniqueCandidates(out, 40);
}

async function searchStockXDirect(query: string): Promise<ImageCandidate[]> {
  // Probe CDN guesses with cheap HEAD requests (parallel batches).
  const guesses = guessStockXProductCandidates(query);
  const hits: ImageCandidate[] = [];
  const batchSize = 8;

  for (let i = 0; i < guesses.length && hits.length < 4; i += batchSize) {
    const batch = guesses.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (guess) => {
        try {
          const res = await fetch(guess.url, {
            method: "HEAD",
            headers: {
              "User-Agent": BROWSER_UA,
              Accept: "image/*,*/*;q=0.8",
              Referer: "https://stockx.com/",
            },
            redirect: "follow",
            signal: AbortSignal.timeout(5_000),
          });
          if (!res.ok) return null;
          const contentType = (res.headers.get("content-type") || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
          if (!contentType.startsWith("image/")) return null;
          const length = Number(res.headers.get("content-length") || 0);
          if (length > 0 && length < MIN_BYTES) return null;
          return guess;
        } catch {
          return null;
        }
      }),
    );
    for (const hit of results) {
      if (!hit) continue;
      hits.push(hit);
      if (hits.length >= 4) break;
    }
  }
  return hits;
}

function extractStockXSlugs(links: string[]): string[] {
  const slugs: string[] = [];
  const skip = new Set([
    "news",
    "about",
    "search",
    "sell",
    "login",
    "signup",
    "help",
    "blog",
    "category",
  ]);
  for (const link of links) {
    const match = link.match(
      /stockx\.com\/(?:[a-z]{2}-[a-z]{2}\/)?([a-z0-9][a-z0-9-]{2,})(?:[/?#]|$)/i,
    );
    if (!match?.[1]) continue;
    const slug = match[1].toLowerCase();
    if (skip.has(slug) || /^[a-z]{2}-[a-z]{2}$/.test(slug)) continue;
    if (slugs.includes(slug)) continue;
    slugs.push(slug);
  }
  return slugs;
}

async function fetchDuckDuckGoVqd(
  query: string,
): Promise<{ vqd: string; cookie?: string } | null> {
  const encoded = encodeURIComponent(query);
  const pages = [
    `https://html.duckduckgo.com/html/?q=${encoded}`,
    `https://lite.duckduckgo.com/lite/?q=${encoded}`,
    `https://duckduckgo.com/?q=${encoded}&iax=images&ia=images`,
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

async function searchDuckDuckGoWebLinks(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const links: string[] = [];
    for (const match of html.matchAll(/uddg=([^&"]+)/g)) {
      try {
        links.push(decodeURIComponent(match[1]));
      } catch {
        // skip bad encoding
      }
    }
    for (const match of html.matchAll(
      /class="result__a"[^>]*href="(https?:\/\/[^"]+)"/g,
    )) {
      links.push(match[1]);
    }
    return Array.from(new Set(links));
  } catch {
    return [];
  }
}

async function fetchMicrolinkImage(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(pageUrl)}&meta=true`,
      {
        headers: {
          "User-Agent": "CurrentSupply/1.0 (inventory; find cover photo)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      data?: { image?: { url?: string } | string | null };
    };
    if (data.status && data.status !== "success") return null;
    const image = data.data?.image;
    if (!image) return null;
    if (typeof image === "string") return image;
    return image.url ?? null;
  } catch {
    return null;
  }
}

async function searchBingWebLinks(query: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en-US`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    const links: string[] = [];
    for (const match of html.matchAll(/href="(https?:\/\/[^"]*stockx\.com[^"]*)"/gi)) {
      links.push(match[1].replace(/&amp;/g, "&"));
    }
    return Array.from(new Set(links));
  } catch {
    return [];
  }
}

/** Prefer StockX catalog product shots (full shoe, white bg, HD). */
async function searchStockXCatalog(query: string): Promise<ImageCandidate[]> {
  const linkLists = await Promise.all([
    searchDuckDuckGoWebLinks(`site:stockx.com ${query}`),
    searchBingWebLinks(`site:stockx.com ${query}`),
  ]);
  const links = linkLists.flat();
  const slugs = extractStockXSlugs(links).slice(0, 5);
  const out: ImageCandidate[] = [];

  for (const slug of slugs) {
    const file = slugToStockXProductFile(slug);
    // Direct CDN first — reliable HD product plates, no page scrape.
    out.push({
      url: upgradeStockXImageUrl(
        `https://images.stockx.com/images/${file}`,
      ),
      width: 1400,
      height: 1000,
      title: `${slug} product`,
      score: 140,
    });

    const ogImage = await fetchMicrolinkImage(`https://stockx.com/${slug}`);
    if (ogImage && !isPlaceholderUrl(ogImage)) {
      out.push({
        url: upgradeStockXImageUrl(ogImage),
        width: 1400,
        height: 1000,
        title: `${slug} product`,
        score: 130,
      });
    }
  }

  return uniqueCandidates(out);
}

async function searchDuckDuckGoImages(query: string): Promise<ImageCandidate[]> {
  const token = await fetchDuckDuckGoVqd(query);
  if (!token) return [];

  const searches = [
    query,
    `${query} product`,
    `${query} stockx`,
  ];

  const rows: ImageCandidate[] = [];
  for (const q of searches) {
    try {
      const res = await fetch(
        `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(token.vqd)}&f=,,,,,&p=1`,
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
      if (!res.ok) continue;
      const data = (await res.json()) as { results?: DdgImageResult[] };
      for (const row of data.results ?? []) {
        const image = String(row.image ?? "").trim();
        if (!image) continue;
        rows.push({
          url: upgradeStockXImageUrl(image),
          width: Number(row.width) || undefined,
          height: Number(row.height) || undefined,
          title: row.title,
        });
      }
    } catch {
      // try next query
    }
  }

  return uniqueCandidates(rankCandidates(rows));
}

async function searchOpenverseImages(query: string): Promise<ImageCandidate[]> {
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
      results?: Array<{
        url?: string;
        thumbnail?: string;
        width?: number;
        height?: number;
        title?: string;
      }>;
    };
    return uniqueCandidates(
      rankCandidates(
        (data.results ?? []).map((row) => ({
          url: String(row.url ?? ""),
          width: row.width,
          height: row.height,
          title: row.title,
        })),
      ),
    );
  } catch {
    return [];
  }
}

/** Last-resort low quality; only used if catalog/search fail. */
async function searchBingThumbnail(query: string): Promise<ImageCandidate[]> {
  const encoded = encodeURIComponent(`${query} product side view`);
  return [
    {
      url: `https://www.bing.com/th?q=${encoded}&w=1600&h=1200&rs=1&p=0&dpr=2&pid=1.7`,
      width: 800,
      height: 600,
      score: -50,
    },
  ];
}

function sniffsLikeImage(buffer: Buffer): boolean {
  if (buffer.byteLength < 12) return false;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return true;
  }
  if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return true;
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") return true;
  return false;
}

function isPlaceholderUrl(url: string): boolean {
  return /placeholder|social-media\.jpg|default-20210415/i.test(url);
}

function normalizeMime(raw: string | null, url: string): string | null {
  const mime = (raw || "").split(";")[0].trim().toLowerCase();
  if (mime.includes("text/html") || mime.includes("application/json")) {
    return null;
  }
  if (ALLOWED_IMAGE_TYPES.has(mime)) return mime;
  if (mime.startsWith("image/")) return mime; // avif/heic → sharp may still decode
  if (/bing\.com\/th\?/i.test(url) || /mm\.bing\.net\/th\?/i.test(url)) {
    return "image/jpeg";
  }
  if (/images\.stockx\.com/i.test(url)) return "image/jpeg";
  const lower = url.toLowerCase();
  if (/\.(png)(\?|$)/.test(lower)) return "image/png";
  if (/\.(webp)(\?|$)/.test(lower)) return "image/webp";
  if (/\.(gif)(\?|$)/.test(lower)) return "image/gif";
  if (/\.(jpe?g)(\?|$)/.test(lower)) return "image/jpeg";
  return null;
}

async function downloadCandidate(url: string): Promise<Buffer | null> {
  if (isPlaceholderUrl(url)) return null;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: "https://stockx.com/",
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
    if (!sniffsLikeImage(buffer)) return null;
    return buffer;
  } catch {
    return null;
  }
}

/**
 * Keep the full shoe visible: fit inside a 1600×1200 white frame with padding.
 * Reject tiny / extreme-crop sources (relaxed for last-resort thumbnails).
 */
async function prepareCoverImage(
  input: Buffer,
  options: { minEdge?: number; allowUpscale?: boolean } = {},
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const minEdge = options.minEdge ?? MIN_EDGE;
  const allowUpscale = options.allowUpscale ?? false;
  try {
    const base = sharp(input, { failOn: "none" }).rotate();
    const meta = await base.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (width < minEdge || height < minEdge) return null;

    const ratio = width / height;
    // Reject extreme crops / banners / logos.
    if (ratio < 0.7 || ratio > 2.2) return null;

    const contentW = Math.round(TARGET_WIDTH * (1 - CONTENT_PAD * 2));
    const contentH = Math.round(TARGET_HEIGHT * (1 - CONTENT_PAD * 2));

    const fitted = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: contentW,
        height: contentH,
        fit: "inside",
        withoutEnlargement: !allowUpscale,
      })
      .toBuffer();

    const buffer = await sharp({
      create: {
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        channels: 3,
        background: "#ffffff",
      },
    })
      .composite([{ input: fitted, gravity: "center" }])
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    if (buffer.byteLength > MAX_PHOTO_BYTES) return null;
    return { buffer, mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}

const PROVIDERS: Array<{
  run: (query: string) => Promise<ImageCandidate[]>;
  minEdge: number;
  allowUpscale: boolean;
}> = [
  { run: searchStockXDirect, minEdge: MIN_EDGE, allowUpscale: false },
  { run: searchStockXCatalog, minEdge: MIN_EDGE, allowUpscale: false },
  { run: searchDuckDuckGoImages, minEdge: MIN_EDGE, allowUpscale: false },
  { run: searchOpenverseImages, minEdge: 400, allowUpscale: true },
  { run: searchBingThumbnail, minEdge: 300, allowUpscale: true },
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
  const tried = new Set<string>();

  for (const provider of PROVIDERS) {
    let candidates: ImageCandidate[] = [];
    try {
      candidates = rankCandidates(await provider.run(query));
    } catch {
      continue;
    }
    if (!candidates.length) continue;
    sawLinks = true;

    for (const candidate of candidates) {
      if (tried.has(candidate.url)) continue;
      tried.add(candidate.url);

      const downloaded = await downloadCandidate(candidate.url);
      if (!downloaded) continue;

      const prepared = await prepareCoverImage(downloaded, {
        minEdge: provider.minEdge,
        allowUpscale: provider.allowUpscale,
      });
      if (!prepared) continue;

      return {
        buffer: prepared.buffer,
        mimeType: prepared.mimeType,
        sourceUrl: candidate.url,
        query,
      };
    }
  }

  if (!sawLinks) {
    throw Object.assign(
      new Error(
        "No photos found for that name. Try a clearer product title (brand + model + colorway).",
      ),
      { status: 404 },
    );
  }

  throw Object.assign(
    new Error(
      "Found image links, but none were a clear full-shoe product shot. Try a more specific name or upload a photo.",
    ),
    { status: 502 },
  );
}
