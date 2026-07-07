import AppWrapper from "@/components/AppWrapper";
import { Product } from "@/db/schema";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useLinkIdentifierToProduct } from "@/src/data/hooks/useLinkIdentifierToProduct";
import { useScanFlow } from "@/state/scanFlow";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { Button, Card, Dialog, Icon, Portal, Snackbar, Text, useTheme } from "react-native-paper";

export default function ChooseExistingProduct() {
  const router = useRouter();
  const { convenience } = useScanFlow();
  const [prods, setProds] = useState<Product[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const productsQ = useProducts();
  const linkIdentifier = useLinkIdentifierToProduct();
  const theme = useTheme();
  
  useEffect(() => {
    if (productsQ.data) {
      setProds(productsQ.data);
    }
  }, [productsQ.data]);

  const handleSelectProduct = async (productId: string) => {
    // Create a product_identifier entry to link the scanned identifier with the selected product
    if (convenience?.identifier && convenience?.identifierType) {
      try {
        await linkIdentifier.mutateAsync({
          productId: productId,
          value: convenience.identifier,
          type: convenience.identifierType,
          createdAt: Date.now(),
        });
        console.log(`Linked identifier ${convenience.identifier} to product ${productId}`);
      } catch (error) {
        console.error('Failed to create product identifier:', error);
        setFeedbackMessage('Failed to link product identifier. Please try again.');
        return;
      }
    }
    
    router.push({
      pathname: '/new/add_pack',
      params: { productId: productId.toString() },
    });
  };

  const handleProductPress = (productName: string) => {
    setSelectedProductName(productName);
    setShowConfirmDialog(true);
  };

  const handleConfirmSelection = () => {
    const selectedProduct = prods.find(prod => prod.name === selectedProductName);
    if (selectedProduct) {
      handleSelectProduct(selectedProduct.id);
    }
    setShowConfirmDialog(false);
  }

  return (
    <AppWrapper>
      <Text variant="headlineLarge" style={{ marginBottom: 16 }}>Could not match this product</Text>
      <Text variant="bodyMedium" style={{ marginBottom: 16 }}>Please select the product from the list below or create a new one.</Text>

      {prods.length !== 0 ? (
        <ScrollView 
          style={{ flex: 1, marginBottom: 16 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {prods.map((prod) => (
            <Card key={prod.id} mode="elevated" elevation={2} style={{marginBottom: 12, overflow: 'hidden'}} onPress={() => handleProductPress(prod.name)}>
              <View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
                <View style={{flexShrink: 0}}>
                  {prod.imageUri && (
                    <Image source={{ uri: prod.imageUri || undefined }} style={{ width: 100, height: 100, backgroundColor: '#eee' }} />
                  ) || (
                    <View style={{ width: 100, height: 100, backgroundColor: theme.colors.surfaceVariant, justifyContent: 'center', alignItems: 'center' }}>
                      <Icon source="image-off" size={36} color={theme.colors.onSurfaceVariant} />
                    </View>
                  )}
                </View>
                <View style={{flex: 1, margin: 12}}>
                  <Text variant="titleLarge">{prod.name}</Text>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Icon source="package-variant-closed-remove" size={64} color={theme.colors.primary} />
          <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>No existing products yet</Text>
          <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.secondary, textAlign: "center" }}>
            Create a new product for this scanned code.
          </Text>
        </View>
      )}
      <Button icon="plus" mode="contained" onPress={() => {router.push('/new/new_product')}}>
        Create New Product
      </Button>

      <Portal>
        <Dialog visible={showConfirmDialog} onDismiss={() => setShowConfirmDialog(false)}>
          <Dialog.Title>Confirm Selection</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">Are you sure that the scanned product corresponds to the selected product <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{selectedProductName}</Text>?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowConfirmDialog(false)}>No</Button>
            <Button onPress={handleConfirmSelection}>Yes</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Snackbar
        visible={feedbackMessage !== null}
        onDismiss={() => setFeedbackMessage(null)}
        duration={4000}
      >
        {feedbackMessage}
      </Snackbar>
    </AppWrapper>
  )
}
