"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DealForm, type DealFormSubmitPayload } from "@/components/DealForm";
import { PageHeader } from "@/components/PageHeader";
import { PageError, PageLoading } from "@/components/PageStatus";
import type { Category } from "@/db/schema";
import { fetchDeal, updateDeal } from "@/lib/dealClient";
import type { DealWithRelations } from "@/lib/deals";
import { getJson } from "@/lib/http";
import { uploadDealCover } from "@/lib/uploadCover";

export default function EditDealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      getJson<Category[]>("/api/categories", "Failed to load categories."),
      fetchDeal(params.id),
    ])
      .then(([cats, d]) => {
        setCategories(cats);
        setDeal(d);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load deal."),
      );
  }, [params.id]);

  if (error) {
    return <PageError message={error} />;
  }

  if (!deal) {
    return <PageLoading label="Loading…" />;
  }

  async function save({ values, coverFile }: DealFormSubmitPayload) {
    await updateDeal(params.id, values);

    if (coverFile) {
      await uploadDealCover(Number(params.id), coverFile);
    }

    router.push(`/inventory/${params.id}`);
  }

  const coverFilename =
    deal.coverPhoto?.filename ?? deal.photos[0]?.filename ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        kicker="Inventory"
        title="Edit deal"
        back={
          <Link
            href={`/inventory/${params.id}`}
            className="mb-1 block text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ← Back to deal
          </Link>
        }
      />
      <DealForm
        categories={categories}
        initial={deal}
        initialCoverFilename={coverFilename}
        submitLabel="Save changes"
        onSubmit={save}
        onCancel={() => router.push(`/inventory/${params.id}`)}
      />
    </div>
  );
}
