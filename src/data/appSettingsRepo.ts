import { AppSetting, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function appSettingsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & { $client: SQLiteDatabase })) {
  return {
    async getAll(): Promise<AppSetting[]> {
      return await db.select().from(appSettings);
    },

    async getByKey<T = any>(key: string): Promise<T | null> {
      const res = await db.select().from(appSettings).where(eq(appSettings.key, key));
      if (res.length === 0) return null;
      return (res[0].value as T) ?? null;
    },

    async upsert<T = any>(key: string, value: T, updatedAt?: number): Promise<void> {
      const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
      const ts = updatedAt ?? Date.now();
      if (existing.length > 0) {
        await db.update(appSettings).set({ value, updatedAt: ts }).where(eq(appSettings.key, key));
      } else {
        await db.insert(appSettings).values({ key, value, updatedAt: ts });
      }
    },

    async remove(key: string): Promise<void> {
      // Not requested, but occasionally useful
      // Drizzle SQLite core has delete; keep for completeness
      const { appSettings: as } = { appSettings };
      await db.delete(as).where(eq(as.key, key));
    },
  };
}
