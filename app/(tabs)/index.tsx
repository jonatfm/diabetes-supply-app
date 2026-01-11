import AppWrapper from "@/components/AppWrapper";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/db/schema";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, FAB, Icon, Searchbar, Text, useTheme } from "react-native-paper";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState('');
  const productsQ = useProducts();
  const [filteredProds, setFilteredProds] = useState<Product[]>([]);
  const theme = useTheme();
  const router = useRouter();


  useEffect(() => {
    if (!productsQ.data) return;

    if (searchQuery.trim() === '') {
      setFilteredProds(productsQ.data);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProds(
        productsQ.data.filter((prod: Product) =>
          prod.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, productsQ.data]);

  return (
    <AppWrapper>
        <Text variant="headlineLarge">Inventory</Text>

        {productsQ.isPending ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>Loading products...</Text>
          </View>
        ) : productsQ.data && productsQ.data.length !== 0 ? (
          <View style={{ flex: 1 }}>
            <Searchbar 
              value={searchQuery} 
              onChangeText={setSearchQuery}
              placeholder="Search products" 
              style={{ marginBottom: 16, marginTop: 32 }} 
            />
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 80 }}
            >
              {filteredProds.map((prod) => (
                <ProductCard key={prod.id} product={prod} onPress={() => router.push(`/product/${prod.id}`)} />
              ))}
            </ScrollView>
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
