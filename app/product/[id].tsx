import AppWrapper from "@/components/AppWrapper";
import { useDatabase } from "@/db";
import { Pack, packs, Product, product_identifiers, ProductIdentifier, products, stock_events, StockEvent } from "@/db/schema";
import { and, desc, eq, lt, ne, sql } from "drizzle-orm";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { Button, Card, Chip, DataTable, Dialog, Icon, Portal, Snackbar, Text, useTheme } from "react-native-paper";

function formatRelativeTime(date: Date | number, nowMs: number): string {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const diffMs = nowMs - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

type ConsumtionDialogInfo = {
  expiryDate: Date | null;
  identifier: string;
  identifierType: "Serial" | "Code";
  unitsLeftInPack: number;
  packId: string;
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
  const [productHistory, setProductHistory] = useState<StockEvent[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [isSnackbarVisible, setIsSnackbarVisible] = useState<boolean>(false);
  const [isDiscardDialogVisible, setIsDiscardDialogVisible] = useState<boolean>(false);
  const theme = useTheme();
  const router = useRouter();

  // Calculate pagination values dynamically
  const from = currentPacksPage * itemsPerPage;
  const to = Math.min((currentPacksPage + 1) * itemsPerPage, productPacks.length);

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
    
    const result = await db.select().from(packs).where(and(eq(packs.productId, id as string), ne(packs.unitsRemaining, 0), eq(packs.active, 1)));
    
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

  const fetchStockHistory = async () => {
    if (!db || !id) return;

    const result = await db.select({
      id: stock_events.id,
      productId: stock_events.productId,
      packId: stock_events.packId,
      type: stock_events.type,
      deltaUnits: stock_events.deltaUnits,
      occuredAt: stock_events.occuredAt,
      createdAt: stock_events.createdAt,
      relatedEventId: stock_events.relatedEventId,
      note: stock_events.note,
      meta: stock_events.meta,
    })
      .from(stock_events)
      .where(eq(stock_events.productId, id as string))
      .orderBy(desc(stock_events.occuredAt));

    setProductHistory(result);
  }

  useEffect(() => {
    if (dbReady && db && id) {
      fetchProduct();
      fetchProductIdentifiers();
      fetchPacks();
      fetchTotalUnits();
      fetchStockHistory();
    }
  }, [dbReady, db, id]);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, []);

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
      packId: chosenPack.id,
    });
  }

  const handleDiscardExpired = async () => {
    if (!db || !id) return;
    if (!product || !product.canHaveExpiry || !packs.expiry) return;

    // Mark all expired packs as inactive
    await db.update(packs).set({ active: 0 }).where(and(
      eq(packs.productId, id as string),
      lt(packs.expiry, new Date().toISOString())
    ));

    setIsDiscardDialogVisible(false);
    // Refresh data
    fetchPacks();
    fetchTotalUnits();
    fetchStockHistory();
  }

  const handleConsumeItem = async () => {
    if (!db || !id || !consumtionDialogInfo) return;
    
    // Decrease units in pack
    const pack = await db.select().from(packs).where(eq(packs.id, consumtionDialogInfo.packId));
    if (pack.length === 0) {
      alert("Error: Pack not found.");
      return;
    }
    const currentUnits = pack[0].unitsRemaining;
    if (currentUnits <= 0) {
      alert("Error: No units left in the selected pack.");
      return;
    }

    await db.update(packs)
      .set({ unitsRemaining: currentUnits - 1 })
      .where(eq(packs.id, consumtionDialogInfo.packId));

    // Log stock event
    await db.insert(stock_events).values({
      productId: id as string,
      packId: consumtionDialogInfo.packId,
      type: "TAKE",
      deltaUnits: -1,
      occuredAt: Date.now(),
      createdAt: Date.now(),
      note: "Via app",
    });

    setIsConsumeDialogVisible(false);

    // Refresh data
    fetchPacks();
    fetchTotalUnits();
    fetchStockHistory();

    // Show snackbar with undo option
    setIsSnackbarVisible(true);
  }

  const handleUndoLastAction = async () => {
    if (!db || !id || !consumtionDialogInfo) return;
    // Find last TAKE event for this product, remove it and add back one unit to the original pack
    const lastTakeEvent = await db.select().from(stock_events)
      .where(and(
        eq(stock_events.productId, id as string),
        eq(stock_events.type, "TAKE")
      ))
      .orderBy(desc(stock_events.occuredAt))
      .limit(1);
    
    if (lastTakeEvent.length === 0) {
      alert("No TAKE event found to undo.");
      return;
    }
    const event = lastTakeEvent[0];
    if (!event.packId) {
      alert("Error: TAKE event has no associated pack.");
      return;
    }
    // Remove the stock event
    await db.delete(stock_events).where(eq(stock_events.id, event.id));
    // Add back one unit to the pack
    const pack = await db.select().from(packs).where(eq(packs.id, event.packId));
    if (pack.length === 0) {
      alert("Error: Original pack not found.");
      return;
    }
    const currentUnits = pack[0].unitsRemaining;
    await db.update(packs)
      .set({ unitsRemaining: currentUnits + 1 })
      .where(eq(packs.id, event.packId));

    // Refresh data
    fetchPacks();
    fetchTotalUnits();
    fetchStockHistory();
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

      <ScrollView>
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

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {product.canHaveExpiry && productPacks.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) && (
                <Chip icon={({size}) => <Icon source="alert" size={size} color={theme.colors.error} />} mode="flat" style={{ backgroundColor: theme.colors.errorContainer }}>
                  <Text variant="labelLarge" style={{ color: theme.colors.error }}>Has expired packs</Text>
                </Chip>
              )}
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
        
        <View style={{marginBottom: 24, gap: 8}}>
          <Button 
            mode="contained" 
            icon="needle" 
            onPress={handlePressConsume}
          >
            Consume item
          </Button>

          {product.canHaveExpiry && productPacks.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) && (
            <Button
              mode="outlined"
              icon="delete"
              onPress={() => setIsDiscardDialogVisible(true)}
            >
              Discard expired packs
            </Button>
          )}
        </View>

        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Packs</Text>
        {productPacks.length > 0 ? (
          <Card style={{ marginBottom: 12 }}>
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
                <DataTable.Row key={pack.id} style={{ backgroundColor: pack.expiry && new Date(pack.expiry) < new Date() ? theme.colors.errorContainer : 'transparent' }}>
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
          <Card style={{ marginBottom: 12 }}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Icon source="package-variant-closed-remove" size={48} color={theme.colors.secondary} />
              <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>
                No packs available
              </Text>
            </Card.Content>
          </Card>
        )}

        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Product History</Text>
        {productHistory.length > 0 ? (
          <Card style={{ marginBottom: 12 }}>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Type</DataTable.Title>
                <DataTable.Title>Units</DataTable.Title>
                <DataTable.Title>Time</DataTable.Title>
                <DataTable.Title>Note</DataTable.Title>
              </DataTable.Header>
              {productHistory.map((event) => (
                <DataTable.Row key={event.id}>
                  <DataTable.Cell>{event.type}</DataTable.Cell>
                  <DataTable.Cell><Text variant="labelLarge" style={{color: event.deltaUnits > 0 ? 'green' : 'red'}}>{event.deltaUnits > 0 ? '+' : ''}{event.deltaUnits}</Text></DataTable.Cell>
                  <DataTable.Cell>{formatRelativeTime(event.occuredAt, now)}</DataTable.Cell>
                  <DataTable.Cell>{event.note || '-'}</DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </Card>
        ) : (
          <Card style={{ marginBottom: 12 }}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Icon source="history" size={48} color={theme.colors.secondary} />
              <Text variant="bodyLarge" style={{ marginTop: 8, color: theme.colors.secondary }}>
                No history available
              </Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>


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
          <Dialog.Actions>
            <Button onPress={() => setIsConsumeDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleConsumeItem}>Consume</Button>  
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isDiscardDialogVisible} onDismiss={() => setIsDiscardDialogVisible(false)}>
          <Dialog.Title>Discard Expired</Dialog.Title>
          <Dialog.Content>
             <Text>Please discard the {productPacks.filter(pack => pack.expiry && new Date(pack.expiry) < new Date()).length} expired pack{productPacks.filter(pack => pack.expiry && new Date(pack.expiry) < new Date()).length !== 1 ? 's' : ''}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsDiscardDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleDiscardExpired}>Discard</Button>  
          </Dialog.Actions>
        </Dialog>

        <Snackbar
          visible={isSnackbarVisible}
          onDismiss={() => setIsSnackbarVisible(false)}
          action={{
            label: "Undo",
            onPress: handleUndoLastAction,
          }}
          style={{backgroundColor: theme.colors.secondaryContainer}}
        ><Text>Took one unit of {product.name}</Text></Snackbar>
      </Portal>
    </AppWrapper>
  );
}
