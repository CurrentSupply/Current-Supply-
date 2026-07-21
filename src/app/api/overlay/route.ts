import { NextResponse } from "next/server";
import { ensureDb, uploadsDir } from "@/db";
import { getDeal } from "@/lib/deals";
import { formatMoney } from "@/lib/format";
import fs from "fs";
import path from "path";
import sharp from "sharp";

export async function POST(request: Request) {
  ensureDb();
  const body = await request.json();
  const dealId = Number(body.dealId);
  const photoId = body.photoId ? Number(body.photoId) : null;
  const priceOverride =
    body.price !== undefined && body.price !== null
      ? Number(body.price)
      : null;
  const sizeOverride =
    body.size !== undefined && body.size !== null
      ? String(body.size)
      : null;

  const deal = await getDeal(dealId);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found." }, { status: 404 });
  }

  const photo =
    (photoId
      ? deal.photos.find((p) => p.id === photoId)
      : deal.coverPhoto) ?? deal.photos[0];

  if (!photo) {
    return NextResponse.json(
      { error: "This deal has no photos to stamp." },
      { status: 400 },
    );
  }

  const filePath = path.join(uploadsDir, photo.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Photo file is missing on disk." },
      { status: 404 },
    );
  }

  const sizeText = (sizeOverride ?? deal.size).trim();
  const priceValue = priceOverride ?? deal.price;
  const priceText = formatMoney(priceValue);

  const image = sharp(filePath);
  const meta = await image.metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 1200;

  const sizeFont = Math.max(28, Math.round(width * 0.045));
  const priceFont = Math.max(36, Math.round(width * 0.07));
  const pad = Math.round(width * 0.04);
  const badgeW = Math.round(width * 0.22);
  const badgeH = Math.round(sizeFont * 2.2);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="55%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(8,18,24,0.72)"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect x="${pad}" y="${pad}" rx="${Math.round(badgeH / 2)}" ry="${Math.round(badgeH / 2)}"
        width="${badgeW}" height="${badgeH}" fill="rgba(15,118,110,0.92)"/>
      <text x="${pad + badgeW / 2}" y="${pad + badgeH / 2 + sizeFont * 0.35}"
        text-anchor="middle" font-family="Arial Black, Helvetica, sans-serif"
        font-size="${sizeFont}" font-weight="800" fill="#F7FBFA">${escapeXml(sizeText)}</text>
      <text x="${pad}" y="${height - pad}"
        font-family="Arial Black, Helvetica, sans-serif"
        font-size="${priceFont}" font-weight="800" fill="#FFFFFF">${escapeXml(priceText)}</text>
    </svg>
  `;

  const stamped = await sharp(filePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  const outName = `stamped-${dealId}-${Date.now()}.jpg`;
  const outPath = path.join(uploadsDir, outName);
  fs.writeFileSync(outPath, stamped);

  return NextResponse.json({
    url: `/uploads/${outName}`,
    filename: outName,
    size: sizeText,
    price: priceText,
  });
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
