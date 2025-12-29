import ProductCard from "@/components/ProductCard";
import { db } from "@/db/migrate";
import { Product, products } from "@/db/schema";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Platform, Text, View } from 'react-native';
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
  const [prods, setProds] = useState<Product[]>([]);

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

  useEffect(() => {
    const fetchProducts = async () => {
      setProds(await db.select().from(products));
    };
    if (dbReady) fetchProducts();
  }, [dbReady]);


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
            <View>
        {prods.map((prod) => (
          <ProductCard key={prod.id} product={prod} />
        ))}
      </View>
    </SafeAreaView>
  );
}
