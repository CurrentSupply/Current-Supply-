export const DEAL_OWNERS = ["mizzy", "mac", "other"] as const;
export type DealOwner = (typeof DEAL_OWNERS)[number];

export const DEAL_OWNER_LABELS: Record<DealOwner, string> = {
  mizzy: "Mizzy",
  mac: "Mac",
  other: "Other",
};

export function parseDealOwner(value: unknown): DealOwner {
  if (value === "mizzy" || value === "mac" || value === "other") return value;
  return "other";
}

export type DealStatus = "in_stock" | "sold";

export type Category = {
  id: number;
  name: string;
  createdAt: string;
};

export type Deal = {
  id: number;
  name: string;
  size: string;
  cost: number;
  price: number;
  condition: string;
  categoryId: number | null;
  status: DealStatus;
  owner: DealOwner;
  purchasedAt: string;
  soldAt: string | null;
  notes: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
};

export type Photo = {
  id: number;
  dealId: number;
  filename: string;
  originalName: string;
  isCover: boolean;
  sortOrder: number;
  createdAt: string;
};

export type CategoryRow = {
  id: number;
  name: string;
  created_at: string;
};

export type DealRow = {
  id: number;
  name: string;
  size: string;
  cost: number;
  price: number;
  condition: string;
  category_id: number | null;
  status: DealStatus;
  owner: DealOwner;
  purchased_at: string;
  sold_at: string | null;
  notes: string;
  platform: string;
  created_at: string;
  updated_at: string;
};

export type PhotoRow = {
  id: number;
  deal_id: number;
  filename: string;
  original_name: string;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
};

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

export function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    dealId: row.deal_id,
    filename: row.filename,
    originalName: row.original_name,
    isCover: Boolean(row.is_cover),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function mapDeal(row: DealRow): Deal {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    cost: Number(row.cost),
    price: Number(row.price),
    condition: row.condition ?? "",
    categoryId: row.category_id,
    status: row.status === "sold" ? "sold" : "in_stock",
    owner: parseDealOwner(row.owner),
    purchasedAt: row.purchased_at,
    soldAt: row.sold_at,
    notes: row.notes ?? "",
    platform: row.platform ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
