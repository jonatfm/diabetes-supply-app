import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import { useDatabase } from "@/db";
import { Product } from "@/db/schema";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { useAddPack } from "@/src/data/hooks/useAddPack";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useColoredDots } from "@/src/data/hooks/useColoredDots";
import { useProduct } from "@/src/data/hooks/useProduct";
import { normalizeExpiryDate } from "@/src/utils/dateUtils";
import { useScanFlow } from "@/state/scanFlow";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Card, HelperText, Text, TextInput } from "react-native-paper";
import { DatePickerInput } from 'react-native-paper-dates';

export default function AddPack() {
  const router = useRouter();
  const params = useLocalSearchParams<{productId: string}>();
  const {convenience} = useScanFlow();
  const { db } = useDatabase();
  const productQ = useProduct(params.productId as string);
  const [product, setProduct] = useState<Product | null>(null);
  const [unitsInPack, setUnitsInPack] = useState<string | undefined>(undefined);
  const canHaveExpiry = product ? product.canHaveExpiry : false;
  const [manualExpiryDate, setManualExpiryDate] = useState<Date | undefined>(undefined);
  const addPack = useAddPack(params.productId as string);

  const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;
  const coloredDots = useColoredDots({includeInactive: true}).data;
  const [displayedDots, setDisplayedDots] = useState<string[] | null>(null);

  // Key that changes only when the *enabled* set changes
  const enabledDotIdsKey = useMemo(() => {
    if (!coloredDots) return "";
    return coloredDots
      .filter((d) => !!(d as any).active) // supports 0/1 or boolean
      .map((d) => d.id)
      .sort()
      .join(",");
  }, [coloredDots]);

  // Generate dots once when component mounts or when dependencies change
  const generateAndDisplayDots = useCallback(async () => {
    if (!coloredDotsEnabled || !product?.useColoredDots || !db) {
      setDisplayedDots(null);
      return;
    }

    const combo = await coloredDotsRepo(db).generateUniqueCombinationForProduct(
      params.productId as string,
      { includeInactive: false } // only enabled dots
    );

    setDisplayedDots(combo ?? []);
  }, [coloredDotsEnabled, product?.useColoredDots, db, params.productId]);

  // Regenerate when enabled/disabled colors change
  useEffect(() => {
    generateAndDisplayDots();
  }, [generateAndDisplayDots, enabledDotIdsKey]);

  useEffect(() => {
    if (productQ.data) {
      setProduct(productQ.data);
      setUnitsInPack(productQ.data.unitsPerPackDefault.toString());
    }
  }, [productQ.data]);


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
    
    await addPack.mutateAsync({
      expiry: normalizeExpiryDate(convenience.expiry) || formattedExpiry,
      productionDate: normalizeExpiryDate(convenience.productionDate),
      units: parseInt(unitsInPack || '1', 10),
      ais: convenience.ais || null,
      note: "Via app",
      dateSetManually: !!manualExpiryDate,
      coloredDotIds: displayedDots || undefined,
    });

    alert('New pack added successfully');
    router.push('/');
  }

  return (
    <AppWrapper>
      <Text variant="headlineLarge" style={{ marginBottom: 24 }}>Add Pack to "{product ? product.name : 'Loading…'}"</Text>
      <View style={{gap: 20, marginTop: 8}}>
        {product && convenience && canHaveExpiry && convenience.expiry && (
          <Text variant="labelLarge">Expiry: {normalizeExpiryDate(convenience.expiry)}</Text>
        )}
        {product && canHaveExpiry && !convenience?.expiry && (
          <>
            <DatePickerInput
              locale="de"
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

        {product && product?.useColoredDots && coloredDotsEnabled && coloredDots && coloredDots.length > 0 && (
          <Card elevation={1}>
            <Card.Title title="Colored Dots" />
            <Card.Content>
              <Text variant="labelLarge">You have enabled the colored dot option.</Text>
              <Text variant="bodySmall">Please check that you have these colors on your sticker sheets, you can toggle them by pressing a color.</Text>
              <View style={{flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8}}>
                {coloredDots.map((dot) => (
                  <ColoredDot key={dot.id} dotId={dot.id} pressToToggle />
                ))}
              </View>
              <View>
                <Text variant="labelLarge">Please label your product as such:</Text>
                <View style={{flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8}}>
                  {displayedDots && displayedDots.length > 0 && (
                    <>
                      {displayedDots.map((dotId, index) => {
                        return <ColoredDot key={index} dotId={dotId} size={32} />;
                      })}
                    </>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
        
        <Button mode="contained" icon="plus" disabled={!product || (canHaveExpiry && !convenience?.expiry && !manualExpiryDate)} onPress={handleAddNewPack}>Add Pack</Button>
      </View>
    </AppWrapper>
  )
}