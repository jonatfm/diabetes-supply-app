import AppWrapper from "@/components/AppWrapper";
import ProductCard from "@/components/ProductCard";
import { Product } from "@/db/schema";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, FAB, Icon, Searchbar, Text, useTheme } from "react-native-paper";

export default function Index() {
  const [searchQuery, setSearchQuery] = useState('');
  const productsQ = useProducts();
  const theme = useTheme();
  const router = useRouter();

  const filteredProds = useMemo(() => {
    if (!productsQ.data) return [];
    
    if (searchQuery.trim() === '') {
      return productsQ.data;
    }
    
    const query = searchQuery.toLowerCase();
    return productsQ.data.filter((prod: Product) =>
      prod.name.toLowerCase().includes(query)
    );
  }, [searchQuery, productsQ.data]);

  const handleProductPress = useCallback((productId: string) => {
    router.push(`/product/${productId}`);
  }, [router]);

  const handleScanPress = useCallback(() => {
    router.push('/scan');
  }, [router]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard 
      key={item.id} 
      product={item} 
      onPress={() => handleProductPress(item.id)} 
    />
  ), [handleProductPress]);

  const keyExtractor = useCallback((item: Product) => item.id, []);

  return (
    <AppWrapper bottomEdge={false}>
        <Text variant="headlineLarge" style={{ marginBottom: 8 }}>Inventory</Text>

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
              style={{ marginBottom: 16, marginTop: 24 }} 
              elevation={1}
            />
            <FlatList
              data={filteredProds}
              renderItem={renderProduct}
              keyExtractor={keyExtractor}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              initialNumToRender={10}
              windowSize={10}
            />
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
            <Icon source="ghost" size={64} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>No products here yet</Text>
            <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Scan a product to get started</Text>
          </View>
        )}

        <FAB 
          icon="data-matrix-scan" 
          label="Scan Product"
          onPress={handleScanPress} 
          style={{
            position: "absolute", 
            bottom: 32, 
            right: 16
          }} 
        />
    </AppWrapper>
  )
}
