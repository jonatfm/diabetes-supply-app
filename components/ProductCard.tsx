import { Product } from "@/db/schema";
import { useDaysUntilOutOfStock } from "@/src/data/hooks/useDaysUntilOutOfStock";
import { usePacks } from "@/src/data/hooks/usePacks";
import { useTotalUnitsByProduct } from "@/src/data/hooks/useTotalUnitsByProduct";
import { formatDateForDisplay } from "@/src/utils/dateUtils";
import React, { useMemo } from "react";
import { Image, Pressable, View } from "react-native";
import { Card, Icon, Text, useTheme } from "react-native-paper";

type ProductNotice = {
  type: 'lowStock' | 'expired' | 'expiringSoon' | 'noStock';
}

const productNoticeIsCritical: Record<ProductNotice['type'], boolean> = {
  noStock: true,
  expired: true,
  expiringSoon: false,
  lowStock: false,
};

function ProductCard({product, onPress}: {product: Product, onPress?: () => void}) {
  const totalUnitsQ = useTotalUnitsByProduct(product.id);
  const packsQ = usePacks(product.id);
  const daysUntilOOSQ = useDaysUntilOutOfStock(product.id);
  const theme = useTheme();

  // Get earliest expiry from packs (already sorted by expiry)
  const earliestExpiry = useMemo(() => {
    if (!product.canHaveExpiry || !packsQ.data?.length) return null;
    return packsQ.data[0]?.expiry ?? null;
  }, [product.canHaveExpiry, packsQ.data]);

  // Compute product notice based on stock and expiry
  const productNotice = useMemo((): ProductNotice | null => {
    const totalUnits = totalUnitsQ.data;
    if (totalUnits === undefined) return null;

    // Highest priority: no stock
    if (totalUnits === 0) {
      return { type: 'noStock' };
    }

    // Check expiry status
    if (earliestExpiry) {
      const expiryDate = new Date(earliestExpiry);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { type: 'expired' };
      } else if (diffDays <= 7) {
        return { type: 'expiringSoon' };
      }
    }

    // Low stock warning
    if (totalUnits < 5) {
      return { type: 'lowStock' };
    }

    return null;
  }, [totalUnitsQ.data, earliestExpiry]);
  
  return (
    <Pressable onPress={onPress}>
      {productNotice && (
        <Card style={[productNoticeIsCritical[productNotice.type] ? {backgroundColor: theme.colors.errorContainer} : {backgroundColor: theme.colors.primaryContainer}, {padding: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0}]}>
          {productNotice?.type === 'lowStock' && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Icon source="alert-circle" size={24} color={theme.colors.primary} />
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Low Stock</Text>
            </View>
          )}
          {productNotice?.type === 'expiringSoon' && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Icon source="alert-circle" size={24} color={theme.colors.primary} />
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>Expiring Soon</Text>
            </View>
          )}
          {productNotice?.type === 'expired' && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Icon source="alert" size={24} color={theme.colors.error} />
              <Text variant="labelLarge" style={{ color: theme.colors.error }}>Expired</Text>
            </View>
          )}
          {productNotice?.type === 'noStock' && (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Icon source="alert" size={24} color={theme.colors.error} />
              <Text variant="labelLarge" style={{ color: theme.colors.error }}>No Stock</Text>
            </View>
          )}
        </Card>
      )}
      <Card mode="elevated" elevation={2} style={[productNotice ? {borderTopLeftRadius: 0, borderTopRightRadius: 0} : {}, {marginBottom: 16, overflow: 'hidden'}]}>
        <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
          <View style={{flexShrink: 0}}>
            {product.imageUri ? (
              <Image source={{ uri: product.imageUri }} style={{ width: 100, height: 100, backgroundColor: '#eee' }} />
            ) : (
              <View style={{ width: 100, height: 100, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                <Icon source="image-off" size={36} color={theme.colors.onSurfaceVariant} />
              </View>
            )}
          </View>
          <View style={{flex: 1, margin: 12}}>
            <Text variant="titleLarge">{product.name}</Text>
            <Text variant="bodyLarge">{totalUnitsQ.data ?? 'Loading…'} units left</Text>
            {packsQ.data && packsQ.data.length > 0 ? (
              <>
                {product.canHaveExpiry ? (
                  <Text variant="bodyLarge">Earliest expiry: {earliestExpiry ? formatDateForDisplay(earliestExpiry) : 'Loading…'}</Text>
                ) : (
                  <Text variant="bodyLarge">(No expiry)</Text>
                )}
              </>
            ) : packsQ.data ? (
              <Text variant="bodyLarge" style={{ color: theme.colors.secondary }}>No packs available!</Text>
            ) : null}
            {daysUntilOOSQ.data?.estimatedDaysUntilOOS && (totalUnitsQ.data ?? 0) > 0 ? (
              <Text variant="bodyLarge">
                {daysUntilOOSQ.data.estimatedDaysUntilOOS.toFixed(1)} days until out of stock
              </Text>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  )
}

export default React.memo(ProductCard);