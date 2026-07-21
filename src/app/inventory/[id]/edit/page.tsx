"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DealForm, type DealFormValues } from "@/components/DealForm";
import type { Category } from "@/db/schema";
import type { DealWithRelations } from "@/lib/deals";

export default function EditDealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [deal, setDeal] = useState<DealWithRelations | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch(`/api/deals/${params.id}`).then(async (r) => {
        if (!r.ok) throw new Error("Deal not found.");
        return r.json();
      }),
    ])
      .then(([cats, d]) => {
        setCategories(cats);
        setDeal(d);
      })
      .catch((err) => setError(err.message));
  }, [params.id]);

  if (error) {
    return <p className="text-[var(--danger)]">{error}</p>;
  }

  if (!deal) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  async function save(values: DealFormValues) {
    const res = await fetch(`/api/deals/${params.id}`, {
      method: "PATCH",
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
    if (!res.ok) throw new Error(data.error || "Could not save deal.");
    router.push(`/inventory/${params.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/inventory/${params.id}`}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)]"
        >
          ← Back to deal
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Edit deal
        </h1>
      </div>
      <DealForm
        categories={categories}
        initial={deal}
        submitLabel="Save changes"
        onSubmit={save}
        onCancel={() => router.push(`/inventory/${params.id}`)}
      />
    </div>
  );
}
