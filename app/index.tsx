import AppWrapper from "@/components/AppWrapper";
import ProductCard from "@/components/ProductCard";
import { db } from "@/db/migrate";
import { Product, products } from "@/db/schema";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { FAB, Icon, Searchbar, Text, useTheme } from "react-native-paper";
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProds, setFilteredProds] = useState<Product[]>([]);
  const theme = useTheme();
  const router = useRouter();

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

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProds(prods);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProds(
        prods.filter((prod) =>
          prod.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, prods]);


  if (!dbReady) {
    return (
      <SafeAreaView>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }
  
  return (
    <AppWrapper>
        <Text variant="headlineLarge">Inventory</Text>

        {prods.length !== 0 ? (
          <View>
            <Searchbar 
              value={searchQuery} 
              onChangeText={setSearchQuery}
              placeholder="Search products" 
              style={{ marginBottom: 16, marginTop: 32 }} 
            />
            <View>
              {filteredProds.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center'}}>
            <Icon source="ghost" size={64} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>No products here yet</Text>
          </View>
        )}

        <FAB icon="data-matrix-scan" size="large" onPress={() => {router.push('/scan')}} style={{position: "absolute", bottom: 16, right: 16}} />
    </AppWrapper>
  )
}
