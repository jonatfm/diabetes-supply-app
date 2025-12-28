import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Platform, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Only import and use SQLite on native platforms
let expoDb: any = null;
let ensureDbReady: any = null;

if (Platform.OS !== 'web') {
  const SQLite = require("expo-sqlite");
  const migrate = require('@/db/migrate');
  
  expoDb = SQLite.openDatabaseSync("db.db");
  ensureDbReady = migrate.ensureDbReady;
}

export default function Index() {
  const [dbReady, setDbReady] = useState(Platform.OS === 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' && ensureDbReady) {
      ensureDbReady().then(() => setDbReady(true)).catch((err: Error) => {
        console.error("Failed to initialize database:", err);
      });
    }
  }, []);

  if (expoDb) {
    useDrizzleStudio(expoDb);
  }

  if (!dbReady) {
    return (
      <SafeAreaView>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView>
      <Text>DiaSupply</Text>
      <Link href="/scan" asChild>
        <Button title="Scan Item" onPress={() => {}} />
      </Link>
    </SafeAreaView>
  );
}
