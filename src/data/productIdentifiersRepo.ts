import { ProductIdentifier, product_identifiers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function productIdentifiersRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async findByValue(value: string): Promise<ProductIdentifier[]> {
      return await db
        .select()
        .from(product_identifiers)
        .where(eq(product_identifiers.value, value));
    },

    async findByTypeAndValue(type: ProductIdentifier["type"], value: string): Promise<ProductIdentifier[]> {
      return await db
        .select()
        .from(product_identifiers)
        .where(and(
          eq(product_identifiers.type, type),
          eq(product_identifiers.value, value),
        ));
    },

    async createIdentifier(params: {productId: string; value: string; type: ProductIdentifier["type"]; createdAt?: number;}) {
      const existing = await this.findByTypeAndValue(params.type, params.value);
      const conflicting = existing.find((identifier) => identifier.productId !== params.productId);
      if (conflicting) {
        throw new Error("identifier-exists");
      }

      const existingForProduct = existing.find((identifier) => identifier.productId === params.productId);
      if (existingForProduct) {
        return [{ id: existingForProduct.id }];
      }

      return await db.insert(product_identifiers).values({
        productId: params.productId,
        value: params.value,
        type: params.type,
        createdAt: params.createdAt ?? Date.now(),
      }).returning({id: product_identifiers.id});
    },

    async getIdentifiersByProductId(productId: string): Promise<ProductIdentifier[]> {
      return await db
        .select()
        .from(product_identifiers)
        .where(eq(product_identifiers.productId, productId));
    }
  }
}
