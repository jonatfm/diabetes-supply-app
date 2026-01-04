import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import migrations from '../drizzle/migrations';

// Keep a single SQLite + Drizzle instance for the app lifetime.
let sqliteDb: any = null;
let drizzleDb: ReturnType<typeof drizzle> | null = null;
let readyPromise: Promise<void> | null = null;

function getOrCreateDb() {
  if (Platform.OS === 'web') {
    throw new Error('Database is not available on web');
  }

  if (!sqliteDb) {
    const SQLite = require('expo-sqlite');
    sqliteDb = SQLite.openDatabaseSync('db.db');
  }

  if (!drizzleDb) {
    drizzleDb = drizzle(sqliteDb);
  }

  return drizzleDb;
}

export const db: ReturnType<typeof drizzle> =
  Platform.OS === 'web'
    ? (null as unknown as ReturnType<typeof drizzle>)
    : getOrCreateDb();

export function getDb() {
  if (Platform.OS === 'web') {
    throw new Error('Database is not available on web');
  }
  return getOrCreateDb();
}

export function getRawDb() {
  if (Platform.OS === 'web') return null;
  if (!sqliteDb) {
    getOrCreateDb();
  }
  return sqliteDb;
}

export function ensureDbReady() {
  if (Platform.OS === 'web') {
    return Promise.resolve();
  }

  if (!readyPromise) {
    readyPromise = migrate(getOrCreateDb(), migrations);
  }

  return readyPromise;
}

export function useDatabase() {
  const dbRef = Platform.OS === 'web' ? null : getOrCreateDb();
  const rawDbRef = Platform.OS === 'web' ? null : getRawDb();
  const [ready, setReady] = useState(Platform.OS === 'web');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    ensureDbReady()
      .then(() => setReady(true))
      .catch((err: Error) => setError(err));
  }, []);

  return {
    db: dbRef,
    rawDb: rawDbRef,
    ready,
    error,
  };
}
