import { db } from "@/db";
import { packs, Product } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
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

export default function ProductCard({product, onPress}: {product: Product, onPress?: () => void}) {
  const [totalUnitsInPacks, setTotalUnitsInPacks] = useState<number | undefined>(undefined);
  const [earliestExpiry, setEarliestExpiry] = useState<string | null>(null);
  const [productNotice, setProductNotice] = useState<ProductNotice | null>(null);
  const theme = useTheme();

  useEffect(() => {
    const fetchTotalUnits = async () => {
      const result = await db.select({
        total: sql<number>`cast(sum(${packs.unitsInPack}) as int)`,
      })
        .from(packs)
        .where(eq(packs.productId, product.id));
      
      const units = result[0]?.total ?? 0;
      setTotalUnitsInPacks(units);
    };

    const fetchEarliestExpiry = async () => {
      if (!product.canHaveExpiry) {
        setEarliestExpiry(null);
        return;
      }

      const result = await db.select({
        earliestExpiry: sql<string>`min(${packs.expiry})`,
      })
        .from(packs)
        .where(eq(packs.productId, product.id));
      
      if (!result[0]?.earliestExpiry) return;
      let unparsed = result[0]?.earliestExpiry;

      setEarliestExpiry(unparsed);
    };

    fetchTotalUnits();
    fetchEarliestExpiry();
  }, [product.id, product.canHaveExpiry]);

  // Set possible product notices
  useEffect(() => {
    if (totalUnitsInPacks === undefined) return;
    setProductNotice(null);

    // Then low stock
    if (totalUnitsInPacks < 5 && totalUnitsInPacks > 0) {
      setProductNotice({
        type: 'lowStock',
      });
    }

    // Then expiring soon
    if (earliestExpiry) {
      const expiryDate = new Date(earliestExpiry);
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7 && diffDays >= 0) {
        setProductNotice({
          type: 'expiringSoon',
        });
        return;
      } else if (diffDays < 0) {
        setProductNotice({
          type: 'expired',
        });
        return;
      }
    }

    // Highest priority: no stock
    if (totalUnitsInPacks === 0) {
      setProductNotice({
        type: 'noStock',
      });
      return;
    }
  }, [totalUnitsInPacks, earliestExpiry]);
  
  return (
    <View onTouchEnd={onPress}>
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
      <Card mode="elevated" style={[productNotice ? {borderTopLeftRadius: 0, borderTopRightRadius: 0} : {}, {marginBottom: 12, overflow: 'hidden'}]}>
        <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
          <View style={{flexShrink: 0}}>
            {product.imageUri && (
              <Image source={{ uri: product.imageUri || undefined }} style={{ width: 100, height: 100, backgroundColor: '#eee' }} />
            ) || (
              <View style={{ width: 100, height: 100, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                <Icon source="image-off" size={36} color={theme.colors.onSurfaceVariant} />
              </View>
            )}
          </View>
          <View style={{flex: 1, margin: 12}}>
            <Text variant="titleLarge">{product.name}</Text>
            <Text variant="bodyLarge">{totalUnitsInPacks ?? 'Loading…'} units left</Text>
            {product.canHaveExpiry ? (
              <Text>Earliest expiry: {earliestExpiry ?? 'Loading…'}</Text>
            ) : (
              <Text>(No expiry)</Text>
            )}
          </View>
        </View>
      </Card>
    </View>
  )
}