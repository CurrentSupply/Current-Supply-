import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

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

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  size: text("size").notNull(),
  cost: doublePrecision("cost").notNull(),
  price: doublePrecision("price").notNull(),
  condition: text("condition").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  status: text("status", { enum: ["in_stock", "sold"] })
    .notNull()
    .default("in_stock"),
  owner: text("owner", { enum: ["mizzy", "mac", "other"] })
    .notNull()
    .default("other"),
  purchasedAt: text("purchased_at").notNull(),
  soldAt: text("sold_at"),
  notes: text("notes").notNull().default(""),
  platform: text("platform").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

export const photos = pgTable("photos", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  isCover: boolean("is_cover").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .default(sql`now()`),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  category: one(categories, {
    fields: [deals.categoryId],
    references: [categories.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  deal: one(deals, {
    fields: [photos.dealId],
    references: [deals.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type Deal = typeof deals.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type DealStatus = "in_stock" | "sold";
