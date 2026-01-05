import { ProductIdentifier, product_identifiers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function productIdentifiersRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async getIdentifiersByProductId(productId: string): Promise<ProductIdentifier[]> {
      return await db
        .select()
        .from(product_identifiers)
        .where(eq(product_identifiers.productId, productId));
    }
  }
}
