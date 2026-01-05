import { Product, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function productRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & {$client: SQLiteDatabase;})) {
  return {
    async getProductById(productId: string): Promise<Product | null> {
      const result = await db
        .select()
        .from(products)
        .where(eq(products.id, productId));
      return result[0] || null;
    },

    async getAllProducts() {
      return db.select().from(products);
    }
  }
}