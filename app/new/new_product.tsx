import AppWrapper from "@/components/AppWrapper";
import { db } from "@/db";
import { product_identifiers, products } from "@/db/schema";
import { BarcodeResult } from "@/modules/frame-processor-v2/src";
import { detectBarcodeFormat, getConvenienceFields, parseGS1Unified } from "@/scripts/gs1";
import { useScanFlow } from "@/state/scanFlow";
import { eq } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";

const addNewProduct = async (barcode: BarcodeResult, name: string, unitsPerPack: number, canHaveExpiry: boolean, imageUri?: string): Promise<number | undefined> => {
  const text = barcode.text ?? '';
  console.log('Barcode text:', text);
  const detected = detectBarcodeFormat(text);
  console.log('Detected format:', detected.format);
  
  let identifier = '';
  let identifierType: 'GTIN' | 'EAN13' | null = null;
  
  if (detected.format === 'GS1') {
    const parsed = parseGS1Unified(text);
    console.log('Parsed GS1:', parsed);
    const conv = getConvenienceFields(parsed);
    console.log('Convenience fields:', conv);
    identifier = conv.identifier;
    identifierType = conv.identifierType;
  } else if (detected.format === 'EAN13') {
    const conv = getConvenienceFields(text);
    identifier = conv.identifier;
    identifierType = conv.identifierType;
  }
  
  console.log('Final identifier:', identifier, 'type:', identifierType);
  if (!identifier || !identifierType) {
    alert('No valid product identifier found in barcode');
    return;
  }

  const existing = await db.select().from(product_identifiers).where(eq(product_identifiers.value, identifier));
  if (existing.length > 0) {
    alert('Product with this identifier already exists. This should not happen here :(');
    return;
  }

  // Check if name is already used
  const existingName = await db.select().from(products).where(eq(products.name, name));
  if (existingName.length > 0) {
    alert('Product name already in use. Please choose a different name.');
    return;
  }

  // First create product:
  let product = await db.insert(products).values({
    name,
    unitsPerPackDefault: unitsPerPack,
    imageUri,
    canHaveExpiry: canHaveExpiry ? 1 : 0,
  }).returning({id: products.id});

  // Then create product identifier:
  await db.insert(product_identifiers).values({
    productId: product[0].id,
    value: identifier,
    type: identifierType,
    createdAt: Date.now(),
  });

  alert(`New product created: ${name} (${identifierType}: ${identifier})`);
  return product[0].id;
}

export default function AddNewProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{ photoUri?: string; name?: string; unitsPerPack?: string }>();
  const { convenience, lastBarcodeResult } = useScanFlow();
  const [name, setName] = useState('');
  const [unitsPerPack, setUnitsPerPack] = useState<number | undefined>(undefined);
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [canHaveExpiry, setCanHaveExpiry] = useState(true);

  useEffect(() => {
    if (params.photoUri) {
      setImageUri(params.photoUri);
    }
    if (params.name) {
      setName(params.name);
    }
    if (params.unitsPerPack) {
      const parsedUnits = parseInt(params.unitsPerPack, 10);
      setUnitsPerPack(Number.isFinite(parsedUnits) ? parsedUnits : undefined);
    }
  }, [params.photoUri, params.name, params.unitsPerPack]);

  const handleTakeProductPhoto = () => {
    router.push({
      pathname: '/new/take_product_photo',
      params: {
        name,
        unitsPerPack: unitsPerPack?.toString() ?? '',
      },
    });
  };

  const handleSaveProduct = async () => {
    console.log(name);
    console.log(unitsPerPack);
    console.log(imageUri);
    if (!lastBarcodeResult || !name || !unitsPerPack) {
      alert('Please fill in all required fields');
      return;
    }

    const productId = await addNewProduct(
      lastBarcodeResult,
      name,
      unitsPerPack,
      canHaveExpiry,
      imageUri,
    );

    if (productId) {
      router.push({
        pathname: '/new/add_pack',
        params: { productId: String(productId) },
      });
    }
  };

  const handleCanHaveExpiryToggle = (value: boolean) => {
    setCanHaveExpiry(value);
  };

  return (
    <AppWrapper>
      <Text variant="headlineLarge">Create Product</Text>
      <View style={{gap: 24, marginTop: 16}}>
        <View style={{gap: 8}}>
          <Text variant="labelLarge">Enter a product name:</Text>
          <TextInput
            label="Product Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Dexcom G7"
          />
        </View>

        {!convenience?.expiry && (
          <View style={{gap: 8}}>
            <Text variant="labelLarge">Can this product have an expiry date?</Text>
            <SegmentedButtons value={canHaveExpiry ? "yes" : "no"} onValueChange={(value) => setCanHaveExpiry(value === "yes")} buttons={[{value: "yes", label: "Yes", icon: "check"}, {value: "no", label: "No", icon: "close"}]} />
          </View>
        )}
        <View>
        <Text>Units per pack:</Text>
          <TextInput
            value={(unitsPerPack ?? '').toString()}
            onChangeText={(text) => {
              const n = parseInt(text.replace(/\D+/g, ''), 10);
              setUnitsPerPack(Number.isFinite(n) ? n : undefined);
            }}
            keyboardType="number-pad"
            placeholder="e.g. 50"
          />
        </View>

        <View style={{gap: 8}}>
          <Button mode={imageUri ? "contained" : "outlined"} icon="camera" onPress={handleTakeProductPhoto}>{imageUri ? "Change Photo" : "Take Photo"}</Button>
          <Button disabled={!name || !unitsPerPack} mode="contained" icon="content-save" onPress={handleSaveProduct}>Save Product</Button>
        </View>
      </View>
    </AppWrapper>
  )
}