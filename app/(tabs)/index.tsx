import AppWrapper from "@/components/AppWrapper";
import ProductCard from "@/components/ProductCard";
import { useDatabase } from "@/db";
import { Product } from "@/db/schema";
import { useActiveHoliday } from "@/src/data/hooks/useActiveHoliday";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { usePackListForHoliday } from "@/src/data/hooks/usePackListForHoliday";
import { packsRepo } from "@/src/data/packsRepo";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from 'react';
import { FlatList, SectionList, View } from 'react-native';
import { ActivityIndicator, Card, FAB, Icon, Searchbar, Switch, Text, useTheme } from "react-native-paper";

type InventoryWarning = {
  productId: string;
  productName: string;
  type: "noStock" | "expired" | "expiringSoon" | "lowStock";
  detail: string;
};

function warningPriority(type: InventoryWarning["type"]) {
  return {
    noStock: 0,
    expired: 1,
    expiringSoon: 2,
    lowStock: 3,
  }[type];
}

function InventoryWarnings({ warnings, onPressProduct }: { warnings: InventoryWarning[]; onPressProduct: (productId: string) => void }) {
  const theme = useTheme();
  const visibleWarnings = warnings.slice(0, 4);
  if (visibleWarnings.length === 0) return null;

  return (
    <Card mode="contained" style={{ marginBottom: 16, backgroundColor: theme.colors.errorContainer }}>
      <Card.Content style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon source="alert" size={22} color={theme.colors.error} />
          <Text variant="titleMedium" style={{ color: theme.colors.onErrorContainer }}>Needs attention</Text>
        </View>
        {visibleWarnings.map((warning) => (
          <Text
            key={`${warning.productId}-${warning.type}`}
            variant="bodyMedium"
            style={{ color: theme.colors.onErrorContainer }}
            onPress={() => onPressProduct(warning.productId)}
          >
            {warning.productName}: {warning.detail}
          </Text>
        ))}
        {warnings.length > visibleWarnings.length ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onErrorContainer }}>
            +{warnings.length - visibleWarnings.length} more item{warnings.length - visibleWarnings.length === 1 ? "" : "s"} need attention.
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

export default function Index() {
  const { db, ready: dbReady } = useDatabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const productsQ = useProducts();
  const activeHolidayQ = useActiveHoliday();
  const packListQ = usePackListForHoliday(activeHolidayQ.data?.id);
  const theme = useTheme();
  const router = useRouter();

  const inventoryWarningsQ = useQuery({
    queryKey: ["inventoryDashboardWarnings", productsQ.data?.map((product) => product.id).join(",") ?? "none"],
    enabled: dbReady && !!db && !!productsQ.data,
    queryFn: async (): Promise<InventoryWarning[]> => {
      const repo = packsRepo(db!);
      const today = new Date();
      const warnings: InventoryWarning[] = [];

      for (const product of productsQ.data!.filter((item) => item.active)) {
        const totalUnits = await repo.totalUnitsByProduct(product.id);
        const activePacks = await repo.listActiveNonEmptyByProduct(product.id);
        const earliestExpiry = product.canHaveExpiry
          ? activePacks.find((pack) => pack.expiry)?.expiry
          : null;

        if (totalUnits === 0) {
          warnings.push({
            productId: product.id,
            productName: product.name,
            type: "noStock",
            detail: "no stock available",
          });
          continue;
        }

        if (earliestExpiry) {
          const expiryDate = new Date(earliestExpiry);
          const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
          if (diffDays < 0) {
            warnings.push({
              productId: product.id,
              productName: product.name,
              type: "expired",
              detail: "oldest pack is expired",
            });
            continue;
          }
          if (diffDays <= 7) {
            warnings.push({
              productId: product.id,
              productName: product.name,
              type: "expiringSoon",
              detail: `oldest pack expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
            });
            continue;
          }
        }

        if (totalUnits < 5) {
          warnings.push({
            productId: product.id,
            productName: product.name,
            type: "lowStock",
            detail: `${totalUnits} unit${totalUnits === 1 ? "" : "s"} left`,
          });
        }
      }

      return warnings.sort((a, b) => warningPriority(a.type) - warningPriority(b.type));
    },
  });

  const filteredProds = useMemo(() => {
    if (!productsQ.data) return [];
    
    const visibleProducts = showArchived
      ? productsQ.data
      : productsQ.data.filter((prod: Product) => prod.active);

    if (searchQuery.trim() === '') {
      return visibleProducts;
    }
    
    const query = searchQuery.toLowerCase();
    return visibleProducts.filter((prod: Product) =>
      prod.name.toLowerCase().includes(query)
    );
  }, [searchQuery, productsQ.data, showArchived]);

  const holidayProductIds = useMemo(() => {
    if (!packListQ.data) return new Set<string>();
    return new Set(packListQ.data.map(item => item.productId));
  }, [packListQ.data]);

  const sections = useMemo(() => {
    if (!activeHolidayQ.data || holidayProductIds.size === 0) return null;
    const onHoliday = filteredProds.filter(p => holidayProductIds.has(p.id));
    const other = filteredProds.filter(p => !holidayProductIds.has(p.id));
    return [
      { title: `On current trip (${activeHolidayQ.data.destination})`, data: onHoliday },
      ...(other.length > 0 ? [{ title: 'Other items not with you', data: other }] : []),
    ];
  }, [activeHolidayQ.data, holidayProductIds, filteredProds]);

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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>Show archived products</Text>
              <Switch value={showArchived} onValueChange={setShowArchived} />
            </View>
            <InventoryWarnings warnings={inventoryWarningsQ.data ?? []} onPressProduct={handleProductPress} />
            {filteredProds.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
                <Icon source="magnify-close" size={48} color={theme.colors.primary} />
                <Text variant="bodyLarge" style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>No matching supplies</Text>
                <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                  Try a different search or enable archived products.
                </Text>
              </View>
            ) : sections ? (
              <SectionList
                sections={sections}
                renderItem={renderProduct}
                keyExtractor={keyExtractor}
                renderSectionHeader={({ section: { title } }) => (
                  <Text variant="titleSmall" style={{ marginTop: 16, marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
                    {title}
                  </Text>
                )}
                contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={10}
                windowSize={10}
                stickySectionHeadersEnabled={false}
              />
            ) : (
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
            )}
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
            <Icon source="package-variant-closed-plus" size={64} color={theme.colors.primary} />
            <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>No supplies tracked yet</Text>
            <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Scan a package or add a pack manually to start tracking stock, expiry dates, and trip supplies.</Text>
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
