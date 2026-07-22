"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DealForm, type DealFormSubmitPayload } from "@/components/DealForm";
import { PageHeader } from "@/components/PageHeader";
import { PageError, PageLoading } from "@/components/PageStatus";
import type { Category } from "@/db/schema";
import { createDeal } from "@/lib/dealClient";
import { getJson } from "@/lib/http";
import { uploadDealCover } from "@/lib/uploadCover";

export default function NewDealPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void getJson<Category[]>("/api/categories", "Failed to load categories.")
      .then(setCategories)
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : "Failed to load categories.",
        ),
      )
      .finally(() => setLoadingCats(false));
  }, []);

  async function onCreate({ values, coverFile }: DealFormSubmitPayload) {
    const data = await createDeal(values);
    if (!data.id) throw new Error("Deal saved but no id was returned.");

    if (coverFile) {
      await uploadDealCover(data.id, coverFile);
    }

    router.push(`/inventory/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker="Inventory"
        title="Add deal"
        back={
          <Link
            href="/inventory"
            className="mb-1 block text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← Back to inventory
          </Link>
        }
      />
      {loadError ? <PageError message={loadError} /> : null}
      {loadingCats ? (
        <PageLoading label="Loading form…" />
      ) : (
        <DealForm
          categories={categories}
          submitLabel="Save deal"
          onSubmit={onCreate}
          onCancel={() => router.push("/inventory")}
        />
      )}
    </div>
  );
}
