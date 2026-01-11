import { ColoredDot, ColoredDotAssignment, coloredDotAssignments, coloredDots, packs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { SQLiteDatabase } from "expo-sqlite";

export function coloredDotsRepo(db: (ExpoSQLiteDatabase<Record<string, unknown>> & { $client: SQLiteDatabase })) {
  return {
    //// Dots --------------------
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
//
    //async updateColor(id: string, color: string): Promise<void> {
    //  await db.update(coloredDots).set({ color }).where(eq(coloredDots.id, id));
    //},

    // Assignments -------------
    async getAssignmentByPackId(packId: string): Promise<ColoredDotAssignment | null> {
      const res = await db.select().from(coloredDotAssignments).where(eq(coloredDotAssignments.packId, packId));
      return res[0] || null;
    },

    async setAssignmentForPack(packId: string, dotIds: string[]): Promise<void> {
      const existing = await this.getAssignmentByPackId(packId);
      if (existing) {
        await db.update(coloredDotAssignments).set({ dotIds }).where(eq(coloredDotAssignments.id, existing.id));
      } else {
        await db.insert(coloredDotAssignments).values({ packId, dotIds });
      }
    },
//
    //async clearAssignmentForPack(packId: string): Promise<void> {
    //  await db.delete(coloredDotAssignments).where(eq(coloredDotAssignments.packId, packId));
    //},

    // Generator ---------------
    async generateUniqueCombinationForProduct(productId: string, opts?: { includeInactive?: boolean }): Promise<string[] | null> {
      const includeInactive = opts?.includeInactive ?? false;

      const colors = includeInactive
        ? await this.getAll()
        : await this.getActive();
      const colorIds = colors.map((c) => c.id);
      if (colorIds.length === 0) return [];

      const productPacks = await db.select({ id: packs.id }).from(packs).where(eq(packs.productId, productId));
      const packIds = productPacks.map((p) => p.id);

      // Collect existing combinations under the product as canonical keys
      const used = new Set<string>();
      for (const pid of packIds) {
        const a = await db
          .select({ dotIds: coloredDotAssignments.dotIds })
          .from(coloredDotAssignments)
          .where(eq(coloredDotAssignments.packId, pid));
        if (a.length && Array.isArray(a[0].dotIds)) {
          const key = (a[0].dotIds as string[]).slice().sort().join(",");
          if (key.length > 0) used.add(key);
        }
      }

      // Helper to shuffle array in-place
      const shuffle = <T,>(arr: T[]): T[] => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };

      // Try size 1 first
      {
        const single = shuffle([...colorIds]);
        for (const id of single) {
          const key = id;
          if (!used.has(key)) return [id];
        }
      }

      // If all singles are used, try increasing sizes starting from 2 (without repetition)
      for (let size = 2; size <= colorIds.length; size++) {
        const ids = [...colorIds];
        // Generate all combinations of given size
        const combos: string[][] = [];
        const backtrack = (start: number, path: string[]) => {
          if (path.length === size) {
            combos.push([...path]);
            return;
          }
          for (let i = start; i < ids.length; i++) {
            path.push(ids[i]);
            backtrack(i + 1, path);
            path.pop();
          }
        };
        backtrack(0, []);
        shuffle(combos);

        for (const combo of combos) {
          const key = combo.slice().sort().join(",");
          if (!used.has(key)) return combo;
        }
      }

      // If all unique combinations are exhausted, try combinations with repetition
      for (let size = 1; size <= colorIds.length + 1; size++) {
        const combos: string[][] = [];
        const backtrackWithRepetition = (path: string[]) => {
          if (path.length === size) {
            combos.push([...path]);
            return;
          }
          for (const id of colorIds) {
            path.push(id);
            backtrackWithRepetition(path);
            path.pop();
          }
        };
        backtrackWithRepetition([]);
        shuffle(combos);

        for (const combo of combos) {
          const key = combo.slice().sort().join(",");
          if (!used.has(key)) return combo;
        }
      }

      // No available combination found
      return null;
    },
  };
}
