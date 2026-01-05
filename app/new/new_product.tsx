import AppWrapper from "@/components/AppWrapper";
import { detectBarcodeFormat, getConvenienceFields, parseGS1Unified } from "@/scripts/gs1";
import { useCreateProductWithIdentifier } from "@/src/data/hooks/useCreateProductWithIdentifier";
import { useScanFlow } from "@/state/scanFlow";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Button, SegmentedButtons, Text, TextInput } from "react-native-paper";

export default function AddNewProduct() {
  const router = useRouter();
  const params = useLocalSearchParams<{ photoUri?: string; name?: string; unitsPerPack?: string }>();
  const { convenience, lastBarcodeResult } = useScanFlow();
  const createProductWithIdentifier = useCreateProductWithIdentifier();
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
    const text = lastBarcodeResult.text ?? '';
    const detected = detectBarcodeFormat(text);

    let identifier = '';
    let identifierType: 'GTIN' | 'UDI_DI' | 'EAN13' | null = null;

    if (detected.format === 'GS1') {
      const parsed = parseGS1Unified(text);
      const conv = getConvenienceFields(parsed);
      identifier = conv.identifier;
      identifierType = conv.identifierType;
    } else if (detected.format === 'EAN13') {
      const conv = getConvenienceFields(text);
      identifier = conv.identifier;
      identifierType = conv.identifierType;
    }

    if (!identifier || !identifierType) {
      alert('No valid product identifier found in barcode');
      return;
    }

    try {
      const productId = await createProductWithIdentifier.mutateAsync({
        name,
        unitsPerPack,
        canHaveExpiry,
        imageUri,
        identifier,
        identifierType,
      });

      if (productId) {
        router.push({
          pathname: '/new/add_pack',
          params: { productId: String(productId) },
        });
      }
    } catch (error) {
      const message = (error as Error).message;
      if (message === 'identifier-exists') {
        alert('Product with this identifier already exists.');
      } else if (message === 'name-exists') {
        alert('Product name already in use. Please choose a different name.');
      } else {
        alert('Failed to save product. Please try again.');
      }
    }
  };

  useEffect(() => {
    if (convenience && convenience.ais && convenience.ais["30"]) {
      const aisUnits = parseInt(convenience.ais["30"], 10);
      if (Number.isFinite(aisUnits)) {
        setUnitsPerPack(aisUnits);
      }
    }
  }, [convenience]);

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

        
        {convenience && convenience.ais && convenience.ais["30"] ? (
          <Text>Units per pack: {convenience.ais["30"]} (The scanned code suggests this value.)</Text>
        ) : (
          <View style={{gap: 8}}>
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
        )}

        <View style={{gap: 8}}>
          <Button mode={imageUri ? "contained" : "outlined"} icon="camera" onPress={handleTakeProductPhoto}>{imageUri ? "Change Photo" : "Take Photo"}</Button>
          <Button disabled={!name || !unitsPerPack} mode="contained" icon="content-save" onPress={handleSaveProduct}>Save Product</Button>
        </View>
      </View>
    </AppWrapper>
  )
}