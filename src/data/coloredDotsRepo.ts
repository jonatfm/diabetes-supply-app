import { ColoredDot, ColoredDotAssignment, coloredDotAssignments, coloredDots, packs } from "@/db/schema";
import { canonicalDotCombinationKey, generateUniqueDotCombination } from "@/src/domain/coloredDotCombinationService";
import { eq, inArray } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function coloredDotsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & { $client: SQLiteDatabase })) {
  return {
    async getAll(): Promise<ColoredDot[]> {
      return await db.select().from(coloredDots);
    },

    async getDot(id: string): Promise<ColoredDot | null> {
      const res = await db.select().from(coloredDots).where(eq(coloredDots.id, id));
      return res[0] || null;
    },

    async getActive(): Promise<ColoredDot[]> {
      return await db.select().from(coloredDots).where(eq(coloredDots.active, true));
    },

    async createDot(params: { color: string; active?: boolean }): Promise<{ id: string }[]> {
      return await db
        .insert(coloredDots)
        .values({ color: params.color, active: params.active === false ? false : true })
        .returning({ id: coloredDots.id });
    },

    async setActive(id: string, active: boolean): Promise<void> {
      await db.update(coloredDots).set({ active: active ? true : false }).where(eq(coloredDots.id, id));
    },

    async getAssignmentByPackId(packId: string): Promise<ColoredDotAssignment | null> {
      const res = await db.select().from(coloredDotAssignments).where(eq(coloredDotAssignments.packId, packId));
      return res[0] || null;
    },

    async setAssignmentForPack(packId: string, dotIds: string[]): Promise<void> {
      const existingAssignments = await db
        .select()
        .from(coloredDotAssignments)
        .where(eq(coloredDotAssignments.packId, packId));

      const existing = existingAssignments[0];
      if (existing) {
        await db
          .update(coloredDotAssignments)
          .set({ dotIds })
          .where(eq(coloredDotAssignments.id, existing.id));

        const duplicateIds = existingAssignments.slice(1).map((assignment) => assignment.id);
        if (duplicateIds.length > 0) {
          await db
            .delete(coloredDotAssignments)
            .where(inArray(coloredDotAssignments.id, duplicateIds));
        }
      } else {
        await db.insert(coloredDotAssignments).values({ packId, dotIds });
      }
    },

    
    async generateUniqueCombinationForProduct(productId: string, opts?: { includeInactive?: boolean }): Promise<string[] | null> {
      const includeInactive = opts?.includeInactive ?? false;

      const colors = includeInactive
        ? await this.getAll()
        : await this.getActive();
      const colorIds = colors.map((c) => c.id);
      if (colorIds.length === 0) return [];

      const assignments = await db
        .select({ dotIds: coloredDotAssignments.dotIds })
        .from(coloredDotAssignments)
        .innerJoin(packs, eq(coloredDotAssignments.packId, packs.id))
        .where(eq(packs.productId, productId));

      const usedKeys = new Set<string>();
      for (const assignment of assignments) {
        if (Array.isArray(assignment.dotIds) && assignment.dotIds.length > 0) {
          usedKeys.add(canonicalDotCombinationKey(assignment.dotIds as string[]));
        }
      }

      return generateUniqueDotCombination({ dotIds: colorIds, usedKeys });
    },
  };
}
