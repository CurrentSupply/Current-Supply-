import { compressImage } from "@/lib/compressImage";
import { postJson } from "@/lib/http";
import { ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from "@/lib/photoLimits";

type SignResponse = {
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
  contentType: string;
};

type RegisterResponse = {
  photos?: { id: number }[];
};

async function signUpload(dealId: number, file: File) {
  return postJson<SignResponse>(
    "/api/uploads/sign",
    {
      dealId,
      contentType: file.type,
      originalName: file.name,
      fileSize: file.size,
    },
    "Could not prepare upload.",
  );
}

async function putToSignedUrl(signedUrl: string, file: File) {
  // PUT bytes straight to Supabase (never through Vercel — avoids 413).
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text.slice(0, 160) || `Storage upload failed (${res.status}).`,
    );
  }
}

async function registerPhoto(
  dealId: number,
  input: {
    path: string;
    originalName: string;
    contentType: string;
    fileSize: number;
    isCover?: boolean;
  },
) {
  return postJson<RegisterResponse>(
    `/api/deals/${dealId}/photos/register`,
    input,
    "Could not save photo.",
  );
}

async function prepareFile(file: File): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  const compressed = await compressImage(file);
  if (compressed.size > MAX_PHOTO_BYTES) {
    throw new Error(`${file.name} is larger than 8MB.`);
  }
  return compressed;
}

/** Upload one or more photos directly to Supabase Storage (bypasses Vercel body limit). */
export async function uploadDealPhotos(
  dealId: number,
  files: File[],
  options: { isCover?: boolean } = {},
) {
  const created: { id: number }[] = [];

  for (let i = 0; i < files.length; i++) {
    const prepared = await prepareFile(files[i]);
    const signed = await signUpload(dealId, prepared);
    await putToSignedUrl(signed.signedUrl, prepared);
    const result = await registerPhoto(dealId, {
      path: signed.path,
      originalName: files[i].name,
      contentType: prepared.type || signed.contentType,
      fileSize: prepared.size,
      isCover: options.isCover && i === 0,
    });
    if (result.photos?.[0]) created.push(result.photos[0]);
  }

  return { photos: created };
}

/** Client helper: upload a file as deal cover. */
export async function uploadDealCover(dealId: number, file: File) {
  return uploadDealPhotos(dealId, [file], { isCover: true });
}
