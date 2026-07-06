import AppWrapper from "@/components/AppWrapper";
import NumberInput from "@/components/NumberInput";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useColoredDots } from "@/src/data/hooks/useColoredDots";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useUpdateProduct } from "@/src/data/hooks/useUpdateProduct";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { ActivityIndicator, Button, Card, Icon, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";

type SettingsParams = {
  id: string;
  photoUri?: string;
  name?: string;
  unitsPerPack?: string;
  active?: string;
  canHaveExpiry?: string;
  isSessionBased?: string;
  nominalSessionTimeDays?: string;
  useColoredDotsForProduct?: string;
};

export default function ProductSettingsPage() {
  const params = useLocalSearchParams<SettingsParams>();
  const {
    id,
    photoUri,
    name: restoredName,
    unitsPerPack: restoredUnitsPerPack,
    active: restoredActive,
    canHaveExpiry: restoredCanHaveExpiry,
    isSessionBased: restoredIsSessionBased,
    nominalSessionTimeDays: restoredNominalSessionTimeDays,
    useColoredDotsForProduct: restoredUseColoredDots,
  } = params;
  const router = useRouter();
  const theme = useTheme();
  const productQ = useProduct(id);
  const updateM = useUpdateProduct(id);

  const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;
  const coloredDots = useColoredDots({ includeInactive: true }).data;

  // Initialize from restored params if available, otherwise wait for productQ data
  const [name, setName] = useState<string>(restoredName ?? "");
  const [imageUri, setImageUri] = useState<string | undefined>(photoUri ?? undefined);
  const [unitsPerPack, setUnitsPerPack] = useState<number | null>(
    restoredUnitsPerPack ? Number(restoredUnitsPerPack) : null
  );
  const [active, setActive] = useState<boolean>(restoredActive ? restoredActive === 'true' : true);
  const [canHaveExpiry, setCanHaveExpiry] = useState<boolean>(
    restoredCanHaveExpiry ? restoredCanHaveExpiry === 'true' : true
  );
  const [isSessionBased, setIsSessionBased] = useState<boolean>(
    restoredIsSessionBased ? restoredIsSessionBased === 'true' : false
  );
  const [nominalSessionTimeDays, setNominalSessionTimeDays] = useState<number | null>(
    restoredNominalSessionTimeDays ? Number(restoredNominalSessionTimeDays) : null
  );
  const [useColoredDotsForProduct, setUseColoredDotsForProduct] = useState<boolean>(
    restoredUseColoredDots ? restoredUseColoredDots === 'true' : false
  );
  const [initializedFromDb, setInitializedFromDb] = useState(false);

  useEffect(() => {
    // Only initialize from DB if we don't have restored params and haven't initialized yet
    if (productQ.data && !initializedFromDb) {
      if (!restoredName) setName(productQ.data.name);
      if (!photoUri) setImageUri(productQ.data.imageUri ?? undefined);
      if (!restoredUnitsPerPack) setUnitsPerPack(productQ.data.unitsPerPackDefault);
      if (!restoredActive) setActive(!!productQ.data.active);
      if (!restoredCanHaveExpiry) setCanHaveExpiry(!!productQ.data.canHaveExpiry);
      if (!restoredIsSessionBased) setIsSessionBased(!!productQ.data.isSessionBased);
      if (!restoredNominalSessionTimeDays) setNominalSessionTimeDays(productQ.data.nominalSessionTimeDays ?? null);
      if (!restoredUseColoredDots) setUseColoredDotsForProduct(!!productQ.data.useColoredDots);
      setInitializedFromDb(true);
    }
  }, [
    productQ.data,
    initializedFromDb,
    restoredName,
    photoUri,
    restoredUnitsPerPack,
    restoredActive,
    restoredCanHaveExpiry,
    restoredIsSessionBased,
    restoredNominalSessionTimeDays,
    restoredUseColoredDots,
  ]);

  const handleSave = async () => {
    if (!unitsPerPack || unitsPerPack < 1) return;
    if (isSessionBased && (!nominalSessionTimeDays || nominalSessionTimeDays < 1)) return;

    await updateM.mutateAsync({
      name: name?.trim() || undefined,
      imageUri: imageUri ?? null,
      unitsPerPackDefault: unitsPerPack,
      active,
      canHaveExpiry,
      isSessionBased,
      nominalSessionTimeDays: isSessionBased ? nominalSessionTimeDays : null,
      useColoredDots: coloredDotsEnabled ? useColoredDotsForProduct : undefined,
    });
    router.back();
  };

  const handleTakePhoto = () => {
    // Use replace instead of push to prevent navigation stack buildup
    // when changing photos repeatedly
    router.replace({
      pathname: '/new/take_product_photo',
      params: {
        returnTo: '/product/settings/[id]',
        id: id,
        name,
        unitsPerPack: unitsPerPack?.toString() ?? '',
        active: active ? 'true' : 'false',
        canHaveExpiry: canHaveExpiry ? 'true' : 'false',
        isSessionBased: isSessionBased ? 'true' : 'false',
        nominalSessionTimeDays: nominalSessionTimeDays?.toString() ?? '',
        useColoredDotsForProduct: useColoredDotsForProduct ? 'true' : 'false',
      },
    });
  };

  if (productQ.isPending) {
    return (
      <AppWrapper>
        <View style={{ marginBottom: 16 }}>
          <Button 
            mode="text" 
            onPress={() => router.back()} 
            icon="arrow-left"
            style={{ alignSelf: 'flex-start' }}
          >
            Back
          </Button>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>Loading product settings...</Text>
        </View>
      </AppWrapper>
    );
  }

  if (!productQ.data) {
    return (
      <AppWrapper>
        <Text>Product not found.</Text>
      </AppWrapper>
    );
  }

  return (
    <AppWrapper>
      <View style={{ marginBottom: 16 }}>
        <Button 
          mode="text" 
          onPress={() => router.back()} 
          icon="arrow-left"
          style={{ alignSelf: 'flex-start' }}
        >
          Back
        </Button>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: 24 }}>
        <Text variant="headlineLarge">Product Settings</Text>

        <Card>
          <Card.Content>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {imageUri ? (
                <Image 
                  source={{ uri: imageUri }} 
                  style={{ width: 80, height: 80, borderRadius: 8, marginRight: 16 }}
                />
              ) : (
                <View 
                  style={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: 8, 
                    backgroundColor: theme.colors.surfaceVariant,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 16
                  }}
                >
                  <Icon source="package-variant" size={40} color={theme.colors.onSurfaceVariant} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <TextInput
                  label="Product Name"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button mode={imageUri ? 'contained' : 'outlined'} icon="camera" onPress={handleTakePhoto}>
                {imageUri ? 'Change Photo' : 'Take Photo'}
              </Button>
            </View>

            <View style={{ gap: 12, marginTop: 24 }}>
              <Text variant="titleMedium">Inventory behavior</Text>
              <NumberInput
                label="Default units per pack"
                value={unitsPerPack}
                minValue={1}
                onChangeText={setUnitsPerPack}
              />
              <View style={{ gap: 8 }}>
                <Text variant="labelLarge">Product status</Text>
                <SegmentedButtons
                  value={active ? 'active' : 'inactive'}
                  onValueChange={(value) => setActive(value === 'active')}
                  buttons={[
                    { value: 'active', label: 'Active', icon: 'check' },
                    { value: 'inactive', label: 'Archived', icon: 'archive' },
                  ]}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Text variant="labelLarge">Can packs expire?</Text>
                <SegmentedButtons
                  value={canHaveExpiry ? 'yes' : 'no'}
                  onValueChange={(value) => setCanHaveExpiry(value === 'yes')}
                  buttons={[
                    { value: 'yes', label: 'Yes', icon: 'calendar-alert' },
                    { value: 'no', label: 'No', icon: 'calendar-remove' },
                  ]}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Text variant="labelLarge">Does one unit start a usage session?</Text>
                <SegmentedButtons
                  value={isSessionBased ? 'yes' : 'no'}
                  onValueChange={(value) => setIsSessionBased(value === 'yes')}
                  buttons={[
                    { value: 'yes', label: 'Yes', icon: 'timer-outline' },
                    { value: 'no', label: 'No', icon: 'counter' },
                  ]}
                />
              </View>
              {isSessionBased && (
                <NumberInput
                  label="Nominal session length in days"
                  value={nominalSessionTimeDays}
                  minValue={1}
                  onChangeText={setNominalSessionTimeDays}
                />
              )}
            </View>

            {coloredDotsEnabled && coloredDots && coloredDots.length > 0 && (
              <View style={{ gap: 8, marginTop: 24 }}>
                <Text variant="labelLarge">Use colored dots for this product?</Text>
                <SegmentedButtons 
                  value={useColoredDotsForProduct ? 'yes' : 'no'} 
                  onValueChange={(value) => setUseColoredDotsForProduct(value === 'yes')} 
                  buttons={[{value: 'yes', label: 'Yes', icon: 'check'}, {value: 'no', label: 'No', icon: 'close'}]} 
                />
                {coloredDotsEnabled && useColoredDotsForProduct && (
                  <View>
                    <Button 
                      mode="outlined" 
                      icon="data-matrix-scan" 
                      onPress={() => router.replace({
                        pathname: `/product/settings/add_colored_dots_scan/[id]`,
                        params: {
                          id,
                          returnName: name,
                          returnImageUri: imageUri ?? '',
                          returnUnitsPerPack: unitsPerPack?.toString() ?? '',
                          returnActive: active ? 'true' : 'false',
                          returnCanHaveExpiry: canHaveExpiry ? 'true' : 'false',
                          returnIsSessionBased: isSessionBased ? 'true' : 'false',
                          returnNominalSessionTimeDays: nominalSessionTimeDays?.toString() ?? '',
                          returnUseColoredDots: useColoredDotsForProduct ? 'true' : 'false',
                        }
                      })}
                    >
                      Add colored codes by scanning
                    </Button>
                  </View>
                )}
              </View>
            )}
           

            <View style={{ gap: 8, marginTop: 24 }}>
              <Button 
                mode="contained" 
                icon="content-save" 
                onPress={handleSave}
                disabled={!name?.trim() || !unitsPerPack || (isSessionBased && !nominalSessionTimeDays)}
              >
                Save Changes
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </AppWrapper>
  );
}
