import AppWrapper from "@/components/AppWrapper";
import { useDatabase } from "@/db";
import { Pack, packs, Product, product_identifiers, ProductIdentifier, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Button, Card, Chip, DataTable, Dialog, Icon, Portal, Text, useTheme } from "react-native-paper";

type ConsumtionDialogInfo = {
  expiryDate: Date | null;
  identifier: string;
  identifierType: "Serial" | "Code";
  unitsLeftInPack: number;
}

export default function ProductPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, ready: dbReady } = useDatabase();
  const [product, setProduct] = useState<Product | null>(null);
  const [productPacks, setProductPacks] = useState<Pack[]>([]);
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [currentPacksPage, setCurrentPacksPage] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [productIdentifiers, setProductIdentifiers] = useState<ProductIdentifier[]>([]);
  const [isConsumeDialogVisible, setIsConsumeDialogVisible] = useState<boolean>(false);
  const [consumtionDialogInfo, setConsumtionDialogInfo] = useState<ConsumtionDialogInfo | null>(null);
  const [isGS1, setIsGS1] = useState<boolean>(false);
  const theme = useTheme();
  const router = useRouter();

  // Calculate pagination values dynamically
  const from = currentPacksPage * itemsPerPage;
  const to = Math.min((currentPacksPage + 1) * itemsPerPage, productPacks.length);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!db || !id) return;
      
      const result = await db.select().from(products).where(eq(products.id, id as string));
      if (result.length > 0) {
        setProduct(result[0]);
      }
    };

    const fetchProductIdentifiers = async () => {
      if (!db || !id) return;
      
      const result = await db.select().from(product_identifiers).where(eq(product_identifiers.productId, id as string));
      setProductIdentifiers(result);
      
      // Check if it's a GS1 item (has GTIN identifier)
      const hasGTIN = result.some(pi => pi.type === "GTIN");
      setIsGS1(hasGTIN);
    };

    const fetchPacks = async () => {
      if (!db || !id) return;
      
      const result = await db.select().from(packs).where(eq(packs.productId, id as string));
      
      // Sort by expiry date if available, otherwise by date added
      const sorted = result.sort((a, b) => {
        const aExpiry = a.expiry ? new Date(a.expiry).getTime() : Infinity;
        const bExpiry = b.expiry ? new Date(b.expiry).getTime() : Infinity;
        
        // If both have expiry dates or both don't, compare them
        if (aExpiry !== Infinity || bExpiry !== Infinity) {
          return aExpiry - bExpiry;
        }
        
        // Otherwise sort by creation date (earliest first)
        return a.createdAt - b.createdAt;
      });
      
      setProductPacks(sorted);
    };

    const fetchTotalUnits = async () => {
      if (!db || !id) return;
      
      const result = await db.select({
        total: sql<number>`cast(sum(${packs.unitsRemaining}) as int)`,
      })
        .from(packs)
        .where(eq(packs.productId, id as string));
      
      setTotalUnits(result[0]?.total ?? 0);
    };

    if (dbReady && db && id) {
      fetchProduct();
      fetchProductIdentifiers();
      fetchPacks();
      fetchTotalUnits();
    }
  }, [dbReady, db, id]);

  useEffect(() => {
    setCurrentPacksPage(0);
  }, [itemsPerPage]);

  const handlePressConsume = () => {
    setIsConsumeDialogVisible(true);
    
    // Never choose a pack that is expired, recommend the one with the nearest expiry date
    const now = new Date();
    const validPacks = productPacks.filter(pack => {
      if (!pack.expiry) return true;
      const expiryDate = new Date(pack.expiry);
      return expiryDate >= now;
    });

    if (validPacks.length === 0) {
      alert("No valid packs available to consume from.");
      setIsConsumeDialogVisible(false);
      return;
    }

    // Choose the pack with the nearest expiry date
    let chosenPack: Pack;
    validPacks.sort((a, b) => {
      const aExpiry = a.expiry ? new Date(a.expiry).getTime() : Infinity;
      const bExpiry = b.expiry ? new Date(b.expiry).getTime() : Infinity;
      return aExpiry - bExpiry;
    });
    chosenPack = validPacks[0];

    // Get identifier / serial for the dialog
    const identifier = chosenPack.ais && chosenPack.ais["21"] ? chosenPack.ais["21"] : (productIdentifiers[0]?.value || 'N/A');

    setConsumtionDialogInfo({
      expiryDate: chosenPack.expiry ? new Date(chosenPack.expiry) : null,
      identifier,
      identifierType: chosenPack.ais && chosenPack.ais["21"] ? "Serial" : "Code",
      unitsLeftInPack: chosenPack.unitsRemaining,
    });
  }

  if (!dbReady || !product) {
    return (
      <AppWrapper>
        <Text>Loading...</Text>
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

      <Card style={{ marginBottom: 24 }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            {product.imageUri ? (
              <Image 
                source={{ uri: product.imageUri }} 
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
              <Text variant="headlineSmall">{product.name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.secondary, marginTop: 4 }}>
                ID: {product.id}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Chip icon="package" mode="flat">
              {totalUnits} units in stock
            </Chip>
            {product.canHaveExpiry ? (
              <Chip icon="calendar-clock" mode="flat">
                Expires
              </Chip>
            ) : null}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text variant="bodyMedium">
              Default units per pack: {product.unitsPerPackDefault}
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 4 }}>
              Status: {product.active ? 'Active' : 'Inactive'}
            </Text>
            <Text variant="bodyMedium" style={{ marginTop: 4 }}>
              {totalUnits} total units across {productPacks.length} pack{productPacks.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Button 
        mode="contained" 
        icon="needle" 
        style={{ marginBottom: 24}} 
        onPress={handlePressConsume}
      >
        Consume item
      </Button>

      <Text variant="titleLarge" style={{ marginBottom: 12 }}>Packs</Text>
      {productPacks.length > 0 ? (
        <Card>
          <DataTable>
            <DataTable.Header>
              {productPacks[0].ais && productPacks[0].ais["21"] && (
                <DataTable.Title>Serial</DataTable.Title>
              )}
              {!isGS1 && productIdentifiers.length > 0 && (
                <DataTable.Title>Identifier</DataTable.Title>
              )}
              <DataTable.Title>Units left</DataTable.Title>
              <DataTable.Title>Expiry</DataTable.Title>
            </DataTable.Header>
            {productPacks.slice(from, to).map((pack) => (
              <DataTable.Row key={pack.id}>
                {pack.ais && pack.ais["21"] ? (
                  <DataTable.Cell>{pack.ais["21"]}</DataTable.Cell>
                ) : null}
                {!isGS1 && productIdentifiers.length > 0 && (
                  <DataTable.Cell>{productIdentifiers[0]?.value.substring(0, 20) || '-'}</DataTable.Cell>
                )}
                <DataTable.Cell>{pack.unitsRemaining}</DataTable.Cell>
                <DataTable.Cell>
                  {pack.expiry ? new Date(pack.expiry).toLocaleDateString() : '-'}
                </DataTable.Cell>
              </DataTable.Row>
            ))}

            <DataTable.Pagination
              page={currentPacksPage}
              numberOfPages={Math.ceil(productPacks.length / itemsPerPage)}
              onPageChange={(page) => setCurrentPacksPage(page)}
              label={`${from + 1}-${to} of ${productPacks.length}`}
              numberOfItemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              showFastPaginationControls
              selectPageDropdownLabel={'Packs per page'}
            />
          </DataTable>
        </Card>
      ) : (
        <Card>
          <Card.Content style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Icon source="package-variant-closed-remove" size={48} color={theme.colors.secondary} />
            <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>
              No packs available
            </Text>
          </Card.Content>
        </Card>
      )}

      <Portal>
        <Dialog visible={isConsumeDialogVisible} onDismiss={() => setIsConsumeDialogVisible(false)}>
          <Dialog.Title>Consume Item</Dialog.Title>
          <Dialog.Content>
            <Text>Please make sure to take exactly one unit from a pack with these <Text style={{ fontWeight: 'bold' }}>exact</Text> attributes:</Text>
            {consumtionDialogInfo ? (
              <View style={{ marginTop: 16 }}>
                <Text>{consumtionDialogInfo.identifierType}: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.identifier}</Text></Text>
                {consumtionDialogInfo.expiryDate && (
                  <Text>Expiry Date: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.expiryDate.toLocaleDateString()}</Text></Text>
                )}
                <Text>Units Left in Pack: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.unitsLeftInPack}</Text></Text>
              </View>
            ) : (
              <Text style={{ marginTop: 16 }}>Loading pack information...</Text>
            )}
          </Dialog.Content>
        </Dialog>
      </Portal>

    </AppWrapper>
  );
}
