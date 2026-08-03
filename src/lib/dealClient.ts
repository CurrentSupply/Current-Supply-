import type { DealFormValues } from "@/components/DealForm";
import type { DealWithRelations } from "@/lib/deals";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/http";

export type SerializedDealPayload = {
  name: string;
  size: string;
  cost: number;
  price: number;
  condition: DealFormValues["condition"];
  hasBox: boolean;
  hasInsoles: boolean;
  categoryId: number | null;
  status: DealFormValues["status"];
  owner: DealFormValues["owner"];
  purchasedAt: string;
  soldAt: string | null;
  notes: string;
  platform: string;
};

export function serializeDealForm(values: DealFormValues): SerializedDealPayload {
  return {
    name: values.name,
    size: values.size,
    cost: Number(values.cost),
    price: Number(values.price),
    condition: values.condition,
    hasBox: values.hasBox,
    hasInsoles: values.hasInsoles,
    categoryId: values.categoryId ? Number(values.categoryId) : null,
    status: values.status,
    owner: values.owner,
    purchasedAt: values.purchasedAt,
    soldAt: values.status === "sold" ? values.soldAt : null,
    notes: values.notes,
    platform: values.platform,
  };
}

export function createDeal(values: DealFormValues) {
  return postJson<DealWithRelations>(
    "/api/deals",
    serializeDealForm(values),
    "Could not create deal.",
  );
}

export type BulkCreateDealsResult = {
  created: DealWithRelations[];
  failed?: { index: number; error: string }[];
};

export function createDealsBulk(rows: SerializedDealPayload[]) {
  return postJson<BulkCreateDealsResult>(
    "/api/deals/bulk",
    { deals: rows },
    "Could not create deals.",
  );
}

export function updateDeal(id: number | string, values: DealFormValues) {
  return patchJson<DealWithRelations>(
    `/api/deals/${id}`,
    serializeDealForm(values),
    "Could not save deal.",
  );
}

export function markDealSold(
  id: number | string,
  input: { price: number; soldAt: string },
) {
  return patchJson<DealWithRelations>(
    `/api/deals/${id}`,
    { status: "sold", price: input.price, soldAt: input.soldAt },
    "Could not mark sold.",
  );
}

export function markDealInStock(id: number | string) {
  return patchJson<DealWithRelations>(
    `/api/deals/${id}`,
    { status: "in_stock" },
    "Could not mark in stock.",
  );
}

export type QuickEditDealFields = {
  name: string;
  size: string;
  cost: number;
  price: number;
  condition: DealFormValues["condition"];
  owner: DealFormValues["owner"];
  categoryId: number;
  platform: string;
};

export function patchDealFields(
  id: number | string,
  fields: QuickEditDealFields,
) {
  return patchJson<DealWithRelations>(
    `/api/deals/${id}`,
    fields,
    "Could not save deal.",
  );
}

export function updateDealSoldAt(id: number | string, soldAt: string) {
  return patchJson<DealWithRelations>(
    `/api/deals/${id}`,
    { soldAt },
    "Could not update sold date.",
  );
}

export function fetchDeal(id: number | string) {
  return getJson<DealWithRelations>(`/api/deals/${id}`, "Deal not found.");
}

export function deleteDeal(id: number | string) {
  return deleteJson(`/api/deals/${id}`, "Could not delete deal.");
}

export type FoundShoeImagePayload = {
  imageBase64: string;
  mimeType: string;
  sourceUrl: string;
  query: string;
};

export function findShoeImage(name: string) {
  return postJson<FoundShoeImagePayload>(
    "/api/find-shoe-image",
    { name },
    "Could not find a photo.",
  );
}

export function attachCoverFromTitle(id: number | string) {
  return postJson<{
    deal: DealWithRelations;
    sourceUrl?: string;
  }>(`/api/deals/${id}/photos/from-title`, {}, "Could not find a photo.");
}
