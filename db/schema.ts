import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({autoIncrement: true}),
  name: text("name").notNull(),
  category: text("category").$type<"sensor" | "insulin" | "needles" | "consumable" | "other">().notNull(),
  imageUri: text("imageUri"),
  defaultUnit: text("defaultUnit").$type<"piece"|"cartridge"|"strip">().notNull(),
  unitsPerPackDefault: integer("unitsPerPackDefault").notNull(),
  active: integer("active").default(1).notNull(),
});

export const product_identifiers = sqliteTable("product_identifiers", {
  id: integer("id").primaryKey({autoIncrement: true}),
  productId: integer("productId").notNull(),
  type: text("type").$type<"GTIN"|"UDI_DI"|"EAN13">().notNull(),
  value: text("value").notNull(),
  createdAt: integer("createdAt").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  }),
]);

export type Product = typeof products.$inferSelect;
export type ProductIdentifier = typeof product_identifiers.$inferSelect;