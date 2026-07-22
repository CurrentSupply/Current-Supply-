"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DealForm, type DealFormSubmitPayload } from "@/components/DealForm";
import type { Category } from "@/db/schema";
import { readJson } from "@/lib/http";
import { uploadDealCover } from "@/lib/uploadCover";

export default function NewDealPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void fetch("/api/categories")
      .then(async (r) => {
        const data = await readJson<Category[] | { error?: string }>(r);
        if (!r.ok) {
          throw new Error(
            "error" in data && data.error
              ? data.error
              : "Failed to load categories.",
          );
        }
        if (!Array.isArray(data)) {
          throw new Error("Failed to load categories.");
        }
        setCategories(data);
      })
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Failed to load categories.",
        ),
      )
      .finally(() => setLoadingCats(false));
  }, []);

  async function createDeal({ values, coverFile }: DealFormSubmitPayload) {
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        cost: Number(values.cost),
        price: Number(values.price),
        categoryId: values.categoryId ? Number(values.categoryId) : null,
        hasBox: values.hasBox,
        hasInsoles: values.hasInsoles,
        soldAt: values.status === "sold" ? values.soldAt : null,
      }),
    });
    const data = await readJson<{ id?: number; error?: string }>(res);
    if (!res.ok) throw new Error(data.error || "Could not create deal.");
    if (!data.id) throw new Error("Deal saved but no id was returned.");

    if (coverFile) {
      await uploadDealCover(data.id, coverFile);
    }

    router.push(`/inventory/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/inventory"
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Back to inventory
        </Link>
        <h1 className="page-title mt-2 text-3xl">Add deal</h1>
      </div>
      {loadError ? (
        <p className="border border-black bg-[#f3f3f3] p-3 text-sm text-[var(--danger)]">
          {loadError}
        </p>
      ) : null}
      {loadingCats ? (
        <p className="text-sm text-[var(--muted)]">Loading form…</p>
      ) : (
        <DealForm
          categories={categories}
          submitLabel="Save deal"
          onSubmit={createDeal}
          onCancel={() => router.push("/inventory")}
        />
      )}
    </div>
  );
}
