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

export const HOLIDAY_ITEM_METHODS = [
  "AVERAGE_PLUS_PERCENTAGE_BUFFER",
  "AVERAGE_PLUS_FIXED_BUFFER",
  "FIXED_AMOUNT",
  "PER_DAY",
  "PER_DAY_PLUS_BUFFER_DAYS"
] as const;
export const HOLIDAY_ITEM_METHODS_LABELS: Record<HolidayItemMethod, string> = {
  AVERAGE_PLUS_PERCENTAGE_BUFFER: "Avg daily usage + buffer %",
  AVERAGE_PLUS_FIXED_BUFFER: "Avg daily usage + fixed buffer",
  FIXED_AMOUNT: "Fixed amount",
  PER_DAY: "Per day",
  PER_DAY_PLUS_BUFFER_DAYS: "Per day + buffer days",
};
export const HOLIDAY_ITEM_METHODS_ATTRIBUTES: Record<HolidayItemMethod, {attributeName: string, attributeLabel: string, default?: number}[]> = {
  AVERAGE_PLUS_PERCENTAGE_BUFFER: [{attributeName: "percentageBuffer", attributeLabel: "Percentage Buffer", default: 20}],
  AVERAGE_PLUS_FIXED_BUFFER: [{attributeName: "fixedBuffer", attributeLabel: "Fixed Buffer", default: 2}],
  FIXED_AMOUNT: [{attributeName: "fixedAmount", attributeLabel: "Fixed Amount"}],
  PER_DAY: [{attributeName: "perDayAmount", attributeLabel: "Per Day Amount"}],
  PER_DAY_PLUS_BUFFER_DAYS: [{attributeName: "perDayAmount", attributeLabel: "Per Day Amount"}, {attributeName: "bufferDays", attributeLabel: "Buffer Days", default: 5}],
};
export type HolidayItemMethod = typeof HOLIDAY_ITEM_METHODS[number];

export const products = sqliteTable("products", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  name: text("name").notNull(),
  imageUri: text("imageUri"),
  unitsPerPackDefault: integer("unitsPerPackDefault").notNull(),
  active: integer("active", {mode: "boolean"}).default(true).notNull(),
  canHaveExpiry: integer("canHaveExpiry", {mode: "boolean"}).default(true).notNull(),
  isSessionBased: integer("isSessionBased", {mode: "boolean"}).default(false).notNull(),
  nominalSessionTimeDays: integer("nominalSessionTimeDays"),
  useColoredDots: integer("useColoredDots", {mode: "boolean"}).default(false).notNull(),
  // requiredForHoliday: integer("requiredForHoliday", {mode: "boolean"}).default(false).notNull(),
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
  active: integer("active", {mode: "boolean"}).default(true),
  dateSetManually: integer("dateSetManually", {mode: "boolean"}).default(false).notNull(),
  rawCode: text("rawCode"),
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
  active: integer("active", {mode: "boolean"}).default(true).notNull(),
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

export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  destination: text("destination").notNull(),
  durationDays: integer("durationDays").$default(() => 0).notNull(),
  state: text("state").$type<"PLANNED" | "PACKED" | "ACTIVE" | "COMPLETE">().notNull(),
  updatedAt: integer("updatedAt").$default(() => Date.now()).notNull(),
});

export const packListForHoliday = sqliteTable("pack_list_for_holiday", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  holidayId: text("holidayId").notNull(),
  productId: text("productId").notNull(),
  amountCalculationType: text("amountCalculationType").$type<(typeof HOLIDAY_ITEM_METHODS)[number]>().notNull(),
  amountCalculationAttributes: text("amountCalculationAttributes", {mode: "json"}).$type<Record<(typeof HOLIDAY_ITEM_METHODS)[number], any>>().notNull(),
  /** Snapshot of the computed amount at holiday-creation time. Null for legacy rows. */
  calculatedAmount: integer("calculatedAmount"),
}, (table) => [
  foreignKey({
    columns: [table.holidayId],
    foreignColumns: [holidays.id],
  }),
  foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  }),
]);

export const packsForHoliday = sqliteTable("packs_for_holiday", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  holidayId: text("holidayId").notNull(),
  packId: text("packId").notNull(),
  /** Remaining holiday-allocated units (decremented on each holiday consume). */
  units: integer("units").notNull(),
  /** Original allocation at packing time (never changes). */
  originalUnits: integer("originalUnits").notNull().default(0),
}, (table) => [
  foreignKey({
    columns: [table.holidayId],
    foreignColumns: [holidays.id],
  }),
  foreignKey({
    columns: [table.packId],
    foreignColumns: [packs.id],
  }),
]);

export const appWarningsForProducts = sqliteTable("app_warnings_for_products", {
  id: text("id").primaryKey().$default(() => uuid.v4() as string),
  productId: text("productId").notNull(),
  type: text("type").$type<"EXPIRY_APPROACHING" | "RUN_OUT_SOON">().notNull(),
  timeInAdvance: integer("timeInAdvance").notNull(),
  createdAt: integer("createdAt").notNull(),
}, (table) => [
  foreignKey({
    columns: [table.productId],
    foreignColumns: [products.id],
  }),
]);

export type Product = typeof products.$inferSelect;
export type ProductIdentifier = typeof product_identifiers.$inferSelect;
export type Pack = typeof packs.$inferSelect;
export type StockEvent = typeof stock_events.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ColoredDot = typeof coloredDots.$inferSelect;
export type ColoredDotAssignment = typeof coloredDotAssignments.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type PackListForHoliday = typeof packListForHoliday.$inferSelect;
export type PacksForHoliday = typeof packsForHoliday.$inferSelect;
export type AppWarningForProduct = typeof appWarningsForProducts.$inferSelect;