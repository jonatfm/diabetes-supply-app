import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({autoIncrement: true}),
  name: text("name").notNull(),
  imageUri: text("imageUri"),
  unitsPerPackDefault: integer("unitsPerPackDefault").notNull(),
  active: integer("active").default(1).notNull(),
  canHaveExpiry: integer("canHaveExpiry").default(1).notNull(),
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

export const packs = sqliteTable("packs", {
  id: integer("id").primaryKey({autoIncrement: true}),
  productId: integer("productId").notNull(),
  lot: text("lot"),
  expiry: text("expiry"),
  productionDate: text("productionDate"),
  createdAt: integer("createdAt").notNull(),
  unitsInPack: integer("itemsInPack").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  })
]);

export type Product = typeof products.$inferSelect;
export type ProductIdentifier = typeof product_identifiers.$inferSelect;
export type Pack = typeof packs.$inferSelect;