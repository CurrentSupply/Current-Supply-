"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BulkDealTable } from "@/components/BulkDealTable";
import { PageHeader } from "@/components/PageHeader";
import { PageError, PageLoading } from "@/components/PageStatus";
import { BackLink } from "@/components/ui";
import type { Category } from "@/db/schema";
import { getJson } from "@/lib/http";

export default function BulkDealsPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void getJson<Category[]>("/api/categories", "Failed to load categories.")
      .then(setCategories)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Failed to load categories."),
      )
      .finally(() => setLoadingCats(false));
  }, []);

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        kicker="Inventory"
        title="Add Multiple Deals"
        subtitle="Spreadsheet-style entry for in-stock items. Photos can be added later on each deal."
        back={<BackLink href="/inventory">Back to Inventory</BackLink>}
        actions={
          <Link href="/inventory/new" className="btn btn-secondary">
            Add Single Deal
          </Link>
        }
      />
      {loadError && <PageError message={loadError} />}
      {loadingCats ? (
        <PageLoading label="Loading form…" />
      ) : (
        <BulkDealTable
          categories={categories}
          onSuccess={() => router.push("/inventory")}
          onCancel={() => router.push("/inventory")}
        />
      )}
    </div>
  );
}
