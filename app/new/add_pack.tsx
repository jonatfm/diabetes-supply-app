import { db } from "@/db/client";
import { packs, Product, products } from "@/db/schema";
import { useScanFlow } from "@/state/scanFlow";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Button, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const getProductInfo = async (productId: number): Promise<Product> => {
  let product = await db.select().from(products).where(eq(products.id, productId));
  if (product.length === 0) {
    throw new Error("Product not found");
  }
  return product[0];
}

export default function AddPack() {
  const router = useRouter();
  const params = useLocalSearchParams<{productId: string}>();
  const {convenience, lastBarcodeResult} = useScanFlow();
  const [product, setProduct] = useState<Product | null>(null);
  const [unitsInPack, setUnitsInPack] = useState<number | undefined>(undefined);
  const [manualExpiry, setManualExpiry] = useState<string>("");
  const canHaveExpiry = product ? product.canHaveExpiry === 1 : false;
  
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const prod = await getProductInfo(Number(params.productId));
        setProduct(prod);
        setUnitsInPack(prod.unitsPerPackDefault);
      } catch (e) {
        console.warn("Failed to fetch product info", e);
      }
    };
    fetchProduct();
  }, [params.productId]);

  const handleAddNewPack = async (productId: number, unitsInPack: number | undefined, convenience: { expiry?: string; lot?: string; identifier: string, productionDate?: string }) => {
    
    if (product && unitsInPack && unitsInPack > product.unitsPerPackDefault) {
      alert(`Error: Cannot add more than ${product.unitsPerPackDefault} units. You entered ${unitsInPack}.`);
      return;
    }

    if (canHaveExpiry && !convenience.expiry) {
      alert("Expiry date is required for this product.");
      return;
    }
    
    await db.insert(packs).values({
      productId,
      lot: convenience.lot,
      expiry: convenience.expiry,
      productionDate: convenience.productionDate,
      createdAt: Date.now(),
      unitsInPack: unitsInPack || 1,
    });
    alert('New pack added successfully');
    router.push('/');
  }

  return (
    <SafeAreaView>
      <Text>Add Pack Screen</Text>
      {product && convenience && canHaveExpiry && convenience.expiry && (
        <Text>Expiry: {convenience.expiry}</Text>
      )}
      {product && canHaveExpiry && !convenience?.expiry && (
        <>
          <Text>Please input an expiry date for this product. (YYYYMMDD)</Text>
          <TextInput
            value={manualExpiry}
            onChangeText={setManualExpiry}
            placeholder="YYYYMMDD"
            style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6, marginBottom: 8 }}
          />
        </>
      )}
      <Text>Lot: {convenience?.lot ?? '—'}</Text>
      <Text>Product ID: {params.productId}</Text>
      <Text>Product Name: {product ? product.name : 'Loading…'}</Text>
      <Text>{convenience?.identifierType ?? 'Identifier'}: {convenience?.identifier ?? '—'}</Text>
      <Text>Production Date: {convenience?.productionDate ?? '—'}</Text>
      {product && product.unitsPerPackDefault > 1 && (
        <>
          <Text>How many out of {product.unitsPerPackDefault} are in this pack?</Text>
          <TextInput value={unitsInPack !== undefined ? unitsInPack.toString() : product.unitsPerPackDefault.toString()} onChangeText={text => setUnitsInPack(Number(text))} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, borderRadius: 6, marginBottom: 8 }} />
        </>
      )}
      <Button title="Add Pack" onPress={() => handleAddNewPack(Number(params.productId), unitsInPack, {
        expiry: convenience?.expiry || manualExpiry,
        lot: convenience?.lot,
        identifier: convenience?.identifier || '',
        productionDate: convenience?.productionDate,
      })} disabled={!product || (canHaveExpiry && !convenience?.expiry && !manualExpiry)} />
    </SafeAreaView>
  )
}