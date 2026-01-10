import { foreignKey, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import uuid from "react-native-uuid";

export const SESSION_OUTCOMES = [
  "completed",
  "failed",
  "removed_early",
  "lost",
  "unknown",
] as const;

export type SessionOutcome = typeof SESSION_OUTCOMES[number];

export const products = sqliteTable("products", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  name: text("name").notNull(),
  imageUri: text("imageUri"),
  unitsPerPackDefault: integer("unitsPerPackDefault").notNull(),
  active: integer("active").default(1).notNull(),
  canHaveExpiry: integer("canHaveExpiry").default(1).notNull(),
  isSessionBased: integer("isSessionBased").default(0).notNull(),
  nominalSessionTimeDays: integer("nominalSessionTimeDays"),
});

export const product_identifiers = sqliteTable("product_identifiers", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  productId: text("productId").notNull(),
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
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  productId: text("productId").notNull(),
  expiry: text("expiry"),
  productionDate: text("productionDate"),
  createdAt: integer("createdAt").notNull(),
  unitsRemaining: integer("unitsRemaining").notNull(),
  ais: text("ais", { mode: "json" }).$type<Record<string, string> | null>(),
  active: integer("active").default(1),
  dateSetManually: integer("dateSetManually").default(0).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  })
]);

export const stock_events = sqliteTable("stock_events", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  productId: text("productId").notNull(),
  packId: text("packId"),
  
  type: text("type").$type<"ADD" | "TAKE" | "DISCARD" | "ADJUST" | "UNDO">().notNull(),
  deltaUnits: integer("deltaUnits"),

  occurredAt: integer("occurredAt").notNull(),
  createdAt: integer("createdAt").notNull(),

  relatedEventId: text("relatedEventId"), // points to original on UNDO
  relatedSessionId: text("relatedSessionId"), // points to session on TAKE

  note: text("note"),
  meta: text("meta", { mode: "json" }).$type<Record<string, any> | null>(),
}, (table) => [
  foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  }),
  foreignKey({
    columns: [table.packId],
    foreignColumns: [packs.id],
  }),
]);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  productId: text("productId").notNull(),
  packId: text("packId"),             // the pack/unit used
  startedAt: integer("startedAt").notNull(),
  endedAt: integer("endedAt"),
  outcome: text("outcome").$type<SessionOutcome>(),
  reason: text("reason"),
  note: text("note"),
  meta: text("meta", { mode: "json" }).$type<Record<string, any> | null>(),
}, (t) => [
  foreignKey({ columns: [t.productId], foreignColumns: [products.id] }),
  foreignKey({ columns: [t.packId], foreignColumns: [packs.id] }),
]);

export const coloredDots = sqliteTable("colored_dots", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  color: text("color").notNull(),
  active: integer("active").default(1).notNull(),
});

export const coloredDotAssignments = sqliteTable("colored_dot_assignments", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  packId: text("packId").notNull(),
  dotIds: text("dotIds", { mode: "json" }).$type<string[]>(),
}, (table) => [
  foreignKey({
    columns: [table.packId],
    foreignColumns: [packs.id],
  }),
]);

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  key: text("key").notNull().unique(),
  value: text("value", {mode: "json"}).$type<any>(),

  updatedAt: integer("updatedAt").notNull(),
});

export type Product = typeof products.$inferSelect;
export type ProductIdentifier = typeof product_identifiers.$inferSelect;
export type Pack = typeof packs.$inferSelect;
export type StockEvent = typeof stock_events.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ColoredDot = typeof coloredDots.$inferSelect;
export type ColoredDotAssignment = typeof coloredDotAssignments.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;