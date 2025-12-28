import { drizzle } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import * as SQLite from "expo-sqlite";

// drizzle-kit outputs these .sql files into your out folder (e.g. ./drizzle)
import migrations from "../drizzle/migrations"; // path depends on your setup

const expoDb = SQLite.openDatabaseSync("db.db"); // must match everywhere
export const db = drizzle(expoDb);

let readyPromise: Promise<void> | null = null;

export function ensureDbReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      // Applies pending migrations; creates tables like product_identifiers
      await migrate(db, migrations);
    })();
  }
  return readyPromise;
}
