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
    },

    async findByName(name: string) {
      return await db.select().from(products).where(eq(products.name, name));
    },

    async createProduct(params: {name: string; unitsPerPackDefault: number; imageUri?: string; canHaveExpiry: boolean; isSessionBased: boolean; nominalSessionTimeDays?: number; useColoredDots: boolean;}) {
      return await db.insert(products).values({
        name: params.name,
        unitsPerPackDefault: params.unitsPerPackDefault,
        imageUri: params.imageUri,
        canHaveExpiry: params.canHaveExpiry ? 1 : 0,
        isSessionBased: params.isSessionBased ? 1 : 0,
        nominalSessionTimeDays: params.nominalSessionTimeDays ?? null,
        useColoredDots: params.useColoredDots ? 1 : 0,
      }).returning({id: products.id});
    },

    async updateProduct(productId: string, params: { name?: string; imageUri?: string | null; useColoredDots?: boolean }) {
      const updateValues: Partial<Product> & { useColoredDots?: number } = {};
      if (typeof params.name === 'string') updateValues.name = params.name;
      if (params.imageUri !== undefined) updateValues.imageUri = params.imageUri ?? null;
      if (typeof params.useColoredDots === 'boolean') updateValues.useColoredDots = params.useColoredDots ? 1 : 0;

      if (Object.keys(updateValues).length === 0) return;

      await db.update(products).set(updateValues).where(eq(products.id, productId));
    }
  }
}