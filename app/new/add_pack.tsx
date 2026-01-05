import AppWrapper from "@/components/AppWrapper";
import { db } from "@/db";
import { packs, Product, products } from "@/db/schema";
import { useScanFlow } from "@/state/scanFlow";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, HelperText, Text, TextInput } from "react-native-paper";
import { DatePickerInput } from 'react-native-paper-dates';

const getProductInfo = async (productId: string): Promise<Product> => {
  let product = await db.select().from(products).where(eq(products.id, productId));
  if (product.length === 0) {
    throw new Error("Product not found");
  }
  return product[0];
}

// Convert YYMMDD format to YYYY-MM-DD, or return as-is if already formatted
const formatDateString = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return undefined;
  
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Convert from YYMMDD to YYYY-MM-DD
  if (/^\d{6}$/.test(dateStr)) {
    const yy = parseInt(dateStr.slice(0, 2), 10);
    // Assume 20xx
    const yyyy = `20${dateStr.slice(0, 2)}`;
    return `${yyyy}-${dateStr.slice(2, 4)}-${dateStr.slice(4, 6)}`;
  }
  
  // Return unchanged if format is unexpected
  return dateStr;
}

export default function AddPack() {
  const router = useRouter();
  const params = useLocalSearchParams<{productId: string}>();
  const {convenience} = useScanFlow();
  const [product, setProduct] = useState<Product | null>(null);
  const [unitsInPack, setUnitsInPack] = useState<string | undefined>(undefined);
  const canHaveExpiry = product ? product.canHaveExpiry === 1 : false;
  const [manualExpiryDate, setManualExpiryDate] = useState<Date | undefined>(undefined);
  

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const prod = await getProductInfo(params.productId as string);
        setProduct(prod);
        setUnitsInPack(prod.unitsPerPackDefault.toString());
      } catch (e) {
        console.warn("Failed to fetch product info", e);
      }
    };
    fetchProduct();
  }, [params.productId]);


  //const handleAddNewPack = async (productId: number, unitsInPack: number | undefined, convenience: { expiry?: string; lot?: string; identifier: string, productionDate?: string }) => {
  const handleAddNewPack = async() => {
    if (!product) return;
    if (!convenience) return;

    // Check unitsInPack validity
    if (unitsInPack && !/^\d+$/.test(unitsInPack)) {
      alert("Error: Units in pack must be a valid number.");
      return;
    }

    if (product && unitsInPack && Number(unitsInPack) > product.unitsPerPackDefault) {
      alert(`Error: Cannot add more than ${product.unitsPerPackDefault} units. You entered ${unitsInPack}.`);
      return;
    }

    if (canHaveExpiry && !convenience.expiry && !manualExpiryDate) {
      alert("Expiry date is required for this product.");
      return;
    }

    // Format manual expiry date as YYYY-MM-DD to match text format in schema
    const formattedExpiry = manualExpiryDate 
      ? `${manualExpiryDate.getFullYear()}-${String(manualExpiryDate.getMonth() + 1).padStart(2, '0')}-${String(manualExpiryDate.getDate()).padStart(2, '0')}`
      : undefined;
    
    await db.insert(packs).values({
      productId: params.productId as string,
      expiry: formatDateString(convenience.expiry) || formattedExpiry,
      productionDate: formatDateString(convenience.productionDate),
      createdAt: Date.now(),
      unitsRemaining: parseInt(unitsInPack || '1', 10),
      ais: convenience.ais || null,
    });
    alert('New pack added successfully');
    router.push('/');
  }

  return (
    <AppWrapper>
      <Text variant="headlineLarge">Add Pack to "{product ? product.name : 'Loading…'}"</Text>
      <View style={{gap: 24, marginTop: 16}}>
        {product && convenience && canHaveExpiry && convenience.expiry && (
          <Text variant="labelLarge">Expiry: {formatDateString(convenience.expiry)}</Text>
        )}
        {product && canHaveExpiry && !convenience?.expiry && (
          <>
            <DatePickerInput
              locale="en"
              label="Expiry Date"
              value={manualExpiryDate}
              onChange={(d) => setManualExpiryDate(d)}
              inputMode="start"
              mode="outlined"
            />
          </>
        )}

        {product && product.unitsPerPackDefault > 1 && (
          <View style={{gap: 8}}>
            <Text variant="labelLarge">How many out of {product.unitsPerPackDefault} are in this pack?</Text>
            <TextInput 
              error={unitsInPack ? !/^\d+$/.test(unitsInPack) || parseInt(unitsInPack) <= 0 || parseInt(unitsInPack) > product.unitsPerPackDefault : false}
              label="Units in Pack" 
              right={<TextInput.Affix text={`/ ${product.unitsPerPackDefault}`} />} 
              value={unitsInPack} 
              onChangeText={setUnitsInPack} 
              keyboardType="numeric" 
            />
            <HelperText type="error" visible={unitsInPack ? !/^\d+$/.test(unitsInPack) || parseInt(unitsInPack) <= 0 || parseInt(unitsInPack) > product.unitsPerPackDefault : false}>
              Please enter a number between 1 and {product.unitsPerPackDefault}
            </HelperText>
          </View>
        )}
        
        <Button mode="contained" icon="plus" disabled={!product || (canHaveExpiry && !convenience?.expiry && !manualExpiryDate)} onPress={handleAddNewPack}>Add Pack</Button>
      </View>
    </AppWrapper>
  )
}