import { ProductIdentifier, product_identifiers } from "@/db/schema";
import { getIdentifierLookupCandidates, normalizeProductIdentifier } from "@/src/domain/scanService";
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
      const normalized = normalizeProductIdentifier(type, value);

      return await db
        .select()
        .from(product_identifiers)
        .where(and(
          eq(product_identifiers.type, normalized.type),
          eq(product_identifiers.value, normalized.value),
        ));
    },

    async findMatchingIdentifier(type: ProductIdentifier["type"], value: string): Promise<ProductIdentifier[]> {
      const matches: ProductIdentifier[] = [];
      const seen = new Set<string>();

      for (const candidate of getIdentifierLookupCandidates(type, value)) {
        const result = await this.findByTypeAndValue(candidate.type, candidate.value);
        for (const identifier of result) {
          if (!seen.has(identifier.id)) {
            seen.add(identifier.id);
            matches.push(identifier);
          }
        }
      }

      return matches;
    },

    async createIdentifier(params: {productId: string; value: string; type: ProductIdentifier["type"]; createdAt?: number;}) {
      const normalized = normalizeProductIdentifier(params.type, params.value);
      const existing = await this.findMatchingIdentifier(normalized.type, normalized.value);
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
        value: normalized.value,
        type: normalized.type,
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
