import { readJson } from "@/lib/http";

/** Client helper: upload a file as deal cover (first photo or force cover). */
export async function uploadDealCover(dealId: number, file: File) {
  const form = new FormData();
  form.append("files", file);
  const res = await fetch(`/api/deals/${dealId}/photos`, {
    method: "POST",
    body: form,
  });
  const data = await readJson<{
    photos?: { id: number }[];
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error || "Could not upload cover photo.");

  const created = data.photos?.[0];
  if (created?.id) {
    const patch = await fetch(`/api/deals/${dealId}/photos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverPhotoId: created.id }),
    });
    if (!patch.ok) {
      throw new Error("Photo uploaded but could not set as cover.");
    }
  }

  return data;
}
