import AppWrapper from "@/components/AppWrapper";
import ProductCard from "@/components/ProductCard";
import { useDatabase } from "@/db";
import { Product, products } from "@/db/schema";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { FAB, Icon, Searchbar, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
  const { db, ready: dbReady, rawDb } = useDatabase();
  const [prods, setProds] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProds, setFilteredProds] = useState<Product[]>([]);
  const theme = useTheme();
  const router = useRouter();

  if (Platform.OS !== 'web') {
    useDrizzleStudio(rawDb ?? undefined);
  }

  useEffect(() => {
    const fetchProducts = async () => {
      if (!db) return;
      setProds(await db.select().from(products));
    };
    if (dbReady && db) fetchProducts();
  }, [dbReady, db]);

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
