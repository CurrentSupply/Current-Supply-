import { relations, sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const deals = sqliteTable("deals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  size: text("size").notNull(),
  cost: real("cost").notNull(),
  price: real("price").notNull(),
  condition: text("condition").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  status: text("status", { enum: ["in_stock", "sold"] })
    .notNull()
    .default("in_stock"),
  purchasedAt: text("purchased_at").notNull(),
  soldAt: text("sold_at"),
  notes: text("notes").notNull().default(""),
  platform: text("platform").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const photos = sqliteTable("photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dealId: integer("deal_id")
    .notNull()
    .references(() => deals.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  isCover: integer("is_cover", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
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
