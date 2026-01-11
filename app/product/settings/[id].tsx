import AppWrapper from "@/components/AppWrapper";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useColoredDots } from "@/src/data/hooks/useColoredDots";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useUpdateProduct } from "@/src/data/hooks/useUpdateProduct";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { ActivityIndicator, Button, Card, Icon, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";

export default function ProductSettingsPage() {
  const { id, photoUri } = useLocalSearchParams<{ id: string; photoUri?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const productQ = useProduct(id);
  const updateM = useUpdateProduct(id);

  const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;
  const coloredDots = useColoredDots({ includeInactive: true }).data;

  const [name, setName] = useState<string>("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [useColoredDotsForProduct, setUseColoredDotsForProduct] = useState<boolean>(false);

  useEffect(() => {
    if (productQ.data) {
      setName(productQ.data.name);
      setImageUri(productQ.data.imageUri ?? undefined);
      setUseColoredDotsForProduct(!!productQ.data.useColoredDots);
    }
  }, [productQ.data]);

  useEffect(() => {
    if (photoUri && typeof photoUri === 'string') {
      setImageUri(photoUri);
    }
  }, [photoUri]);

  const handleSave = async () => {
    await updateM.mutateAsync({
      name: name?.trim() || undefined,
      imageUri: imageUri ?? null,
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

      <View style={{ gap: 24 }}>
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

            {coloredDotsEnabled && coloredDots && coloredDots.length > 0 && (
              <View style={{ gap: 8, marginTop: 24 }}>
                <Text variant="labelLarge">Use colored dots for this product?</Text>
                <SegmentedButtons 
                  value={useColoredDotsForProduct ? 'yes' : 'no'} 
                  onValueChange={(value) => setUseColoredDotsForProduct(value === 'yes')} 
                  buttons={[{value: 'yes', label: 'Yes', icon: 'check'}, {value: 'no', label: 'No', icon: 'close'}]} 
                />
              </View>
            )}

            <View style={{ gap: 8, marginTop: 24 }}>
              <Button 
                mode="contained" 
                icon="content-save" 
                onPress={handleSave}
                disabled={!name?.trim()}
              >
                Save Changes
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </AppWrapper>
  );
}
