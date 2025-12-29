import { db } from "@/db/client";
import { packs, Product } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

export default function ProductCard({product}: {product: Product}) {
  const [totalUnitsInPacks, setTotalUnitsInPacks] = useState<number | undefined>(undefined);
  const [earliestExpiry, setEarliestExpiry] = useState<string | null>(null);

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
      const result = await db.select({
        earliestExpiry: sql<string>`min(${packs.expiry})`,
      })
        .from(packs)
        .where(eq(packs.productId, product.id));
      
      if (!result[0]?.earliestExpiry) return;
      let unparsed = result[0]?.earliestExpiry;

      const expiry = '20' + unparsed.slice(0, 2) + '-' + unparsed.slice(2, 4) + '-' + unparsed.slice(4, 6);
      setEarliestExpiry(expiry);
    };

    fetchTotalUnits();
    fetchEarliestExpiry();
  }, [product.id]);

  return (
    <View>
      <Text>{product.name} ({totalUnitsInPacks ?? 'Loading…'} units) (Earliest expiry: {earliestExpiry ?? 'Loading…'})</Text>
      <Image source={{ uri: product.imageUri || undefined }} style={{ width: 100, height: 100, backgroundColor: '#eee' }} />
    </View>
  )
}