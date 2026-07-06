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

    async createProduct(params: {
      name: string;
      unitsPerPackDefault: number;
      imageUri?: string;
      canHaveExpiry: boolean;
      isSessionBased: boolean;
      nominalSessionTimeDays?: number;
      useColoredDots: boolean;
      requiredForHoliday?: boolean;
    }) {
      return await db.insert(products).values({
        name: params.name,
        unitsPerPackDefault: params.unitsPerPackDefault,
        imageUri: params.imageUri,
        canHaveExpiry: params.canHaveExpiry,
        isSessionBased: params.isSessionBased,
        nominalSessionTimeDays: params.nominalSessionTimeDays ?? null,
        useColoredDots: params.useColoredDots,
        // requiredForHoliday: params.requiredForHoliday ?? false,
      }).returning({id: products.id});
    },

    async updateProduct(productId: string, params: {
      name?: string;
      imageUri?: string | null;
      unitsPerPackDefault?: number;
      active?: boolean;
      canHaveExpiry?: boolean;
      isSessionBased?: boolean;
      nominalSessionTimeDays?: number | null;
      useColoredDots?: boolean;
    }) {
      const updateValues: Partial<Product> & { useColoredDots?: boolean } = {};
      if (typeof params.name === 'string') updateValues.name = params.name;
      if (params.imageUri !== undefined) updateValues.imageUri = params.imageUri ?? null;
      if (typeof params.unitsPerPackDefault === 'number') updateValues.unitsPerPackDefault = params.unitsPerPackDefault;
      if (typeof params.active === 'boolean') updateValues.active = params.active;
      if (typeof params.canHaveExpiry === 'boolean') updateValues.canHaveExpiry = params.canHaveExpiry;
      if (typeof params.isSessionBased === 'boolean') updateValues.isSessionBased = params.isSessionBased;
      if (params.nominalSessionTimeDays !== undefined) updateValues.nominalSessionTimeDays = params.nominalSessionTimeDays;
      if (typeof params.useColoredDots === 'boolean') updateValues.useColoredDots = params.useColoredDots;

      if (Object.keys(updateValues).length === 0) return;

      await db.update(products).set(updateValues).where(eq(products.id, productId));
    },
  }
}
