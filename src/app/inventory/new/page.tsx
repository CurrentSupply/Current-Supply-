"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DealForm, type DealFormSubmitPayload } from "@/components/DealForm";
import type { Category } from "@/db/schema";
import { uploadDealCover } from "@/lib/uploadCover";

export default function NewDealPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void fetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories);
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
        soldAt: values.status === "sold" ? values.soldAt : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not create deal.");

    if (coverFile) {
      await uploadDealCover(data.id, coverFile);
    }

    router.push(`/inventory/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/inventory" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
          ← Back to inventory
        </Link>
        <h1 className="page-title mt-2 text-3xl">
          Add deal
        </h1>
      </div>
      <DealForm
        categories={categories}
        submitLabel="Save deal"
        onSubmit={createDeal}
        onCancel={() => router.push("/inventory")}
      />
    </div>
  );
}
