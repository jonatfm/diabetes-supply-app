import AppWrapper from "@/components/AppWrapper";
import { useDatabase } from "@/db";
import { Pack } from "@/db/schema";
import { useConsumeOneUnit } from "@/src/data/hooks/useConsumeOneUnit";
import { useGetStockHistoryByProduct } from "@/src/data/hooks/useGetStockHistoryByProduct";
import { useHandleDiscardExpired } from "@/src/data/hooks/useHandleDiscardExpired";
import { usePacks } from "@/src/data/hooks/usePacks";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useProductIdentifiers } from "@/src/data/hooks/useProductIdentifiers";
import { useTotalUnitsByProduct } from "@/src/data/hooks/useTotalUnitsByProduct";
import { useUndoLastTakeActionFromProduct } from "@/src/data/hooks/useUndoLastTakeActionFromProduct";
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
  const [currentPacksPage, setCurrentPacksPage] = useState<number>(0);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isConsumeDialogVisible, setIsConsumeDialogVisible] = useState<boolean>(false);
  const [consumtionDialogInfo, setConsumtionDialogInfo] = useState<ConsumtionDialogInfo | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [isSnackbarVisible, setIsSnackbarVisible] = useState<boolean>(false);
  const [isDiscardDialogVisible, setIsDiscardDialogVisible] = useState<boolean>(false);
  const packsQ = usePacks(id);
  const productQ = useProduct(id);
  const productIdentifiersQ = useProductIdentifiers(id);
  const consumeMut = useConsumeOneUnit(id);
  const totalUnitsQ = useTotalUnitsByProduct(id);
  const productHistoryQ = useGetStockHistoryByProduct(id);
  const discardExpiredM = useHandleDiscardExpired(id);
  const undoLastTakeActionM = useUndoLastTakeActionFromProduct(id);
  
  const isGS1 = productIdentifiersQ.data?.some(pi => pi.type === "GTIN") ?? false;
  const theme = useTheme();
  const router = useRouter();

  // Calculate pagination values dynamically
  const from = currentPacksPage * itemsPerPage;
  const to = Math.min((currentPacksPage + 1) * itemsPerPage, packsQ.data?.length || 0);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setCurrentPacksPage(0);
  }, [itemsPerPage]);

  const handlePressConsume = () => {
    if (!packsQ.data) return;
    setIsConsumeDialogVisible(true);
    
    // Never choose a pack that is expired, recommend the one with the nearest expiry date
    const now = new Date();
    const validPacks = packsQ.data?.filter(pack => {
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
    const identifier = chosenPack.ais && chosenPack.ais["21"] ? chosenPack.ais["21"] : (productIdentifiersQ.data?.[0]?.value || 'N/A');

    setConsumtionDialogInfo({
      expiryDate: chosenPack.expiry ? new Date(chosenPack.expiry) : null,
      identifier,
      identifierType: chosenPack.ais && chosenPack.ais["21"] ? "Serial" : "Code",
      unitsLeftInPack: chosenPack.unitsRemaining,
      packId: chosenPack.id,
    });
  }

  const handleDiscardExpired = async () => {
    await discardExpiredM.mutateAsync({productId: id});

    setIsDiscardDialogVisible(false);
  }

  const handleConsumeItem = async () => {
    if (!consumtionDialogInfo) return;
    
    await consumeMut.mutateAsync({packId: consumtionDialogInfo.packId});

    setIsConsumeDialogVisible(false);

    // Show snackbar with undo option
    setIsSnackbarVisible(true);
  }

  const handleUndoLastAction = async () => {
    if (!db || !id || !consumtionDialogInfo) return;
    await undoLastTakeActionM.mutateAsync({productId: id});
  }

  if (!dbReady || productQ.isPending || packsQ.isPending) {
    return (
      <AppWrapper>
        <Text>Loading...</Text>
      </AppWrapper>
    );
  }

  if (!productQ.data) {
    return (
      <AppWrapper>
        <Text>Product not found.</Text>
      </AppWrapper>
    )
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
              {productQ.data.imageUri ? (
                <Image 
                  source={{ uri: productQ.data.imageUri }} 
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
                <Text variant="headlineSmall">{productQ.data.name}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.secondary, marginTop: 4 }}>
                  ID: {productQ.data.id}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {productQ.data.canHaveExpiry && packsQ.data?.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) && (
                <Chip icon={({size}) => <Icon source="alert" size={size} color={theme.colors.error} />} mode="flat" style={{ backgroundColor: theme.colors.errorContainer }}>
                  <Text variant="labelLarge" style={{ color: theme.colors.error }}>Has expired packs</Text>
                </Chip>
              )}
              <Chip icon="package" mode="flat">
                {totalUnitsQ.data} units in stock
              </Chip>
              {productQ.data.canHaveExpiry ? (
                <Chip icon="calendar-clock" mode="flat">
                  Expires
                </Chip>
              ) : null}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text variant="bodyMedium">
                Default units per pack: {productQ.data.unitsPerPackDefault}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                Status: {productQ.data.active ? 'Active' : 'Inactive'}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                {totalUnitsQ.data ?? 0} total units across {packsQ.data?.length} pack{packsQ.data?.length !== 1 ? 's' : ''}
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

          {productQ.data.canHaveExpiry && packsQ.data?.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) && (
            <Button
              mode="outlined"
              icon="delete"
              onPress={() => setIsDiscardDialogVisible(true)}
            >
              Discard expired packs
            </Button>
          )}
        </View>
        
        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
          <Text variant="titleLarge">Packs</Text>
          {productQ.data && productQ.data.id && packsQ.data && packsQ.data.length > 0 && (
            <Button icon="pencil" onPress={() => router.push(`/product/edit/${productQ.data!.id}`)}>Edit</Button>
          )}
        </View>
        {packsQ.data && (
          packsQ.data.length > 0 ? (
            <Card style={{ marginBottom: 12 }}>
              <DataTable>
                <DataTable.Header>
                  {packsQ.data[0].ais && packsQ.data[0].ais["21"] && (
                    <DataTable.Title>Serial</DataTable.Title>
                  )}
                  {!isGS1 && productIdentifiersQ.data && productIdentifiersQ.data.length > 0 && (
                    <DataTable.Title>Code</DataTable.Title>
                  )}
                  <DataTable.Title>Units left</DataTable.Title>
                  <DataTable.Title>Expiry</DataTable.Title>
                </DataTable.Header>
                {packsQ.data.slice(from, to).map((pack) => (
                  <DataTable.Row key={pack.id} style={{ backgroundColor: pack.expiry && new Date(pack.expiry) < new Date() ? theme.colors.errorContainer : 'transparent' }}>
                    {pack.ais && pack.ais["21"] ? (
                      <DataTable.Cell>{pack.ais["21"]}</DataTable.Cell>
                    ) : null}
                    {!isGS1 && productIdentifiersQ.data && productIdentifiersQ.data.length > 0 && (
                      <DataTable.Cell>{productIdentifiersQ.data[0]?.value.substring(0, 20) || '-'}</DataTable.Cell>
                    )}
                    <DataTable.Cell>{pack.unitsRemaining}</DataTable.Cell>
                    <DataTable.Cell>
                      {pack.expiry ? new Date(pack.expiry).toLocaleDateString() : '-'}
                    </DataTable.Cell>
                  </DataTable.Row>
                ))}

                <DataTable.Pagination
                  page={currentPacksPage}
                  numberOfPages={Math.ceil(packsQ.data.length / itemsPerPage)}
                  onPageChange={(page) => setCurrentPacksPage(page)}
                  label={`${from + 1}-${to} of ${packsQ.data.length}`}
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
          )
        )}

        <Text variant="titleLarge" style={{ marginBottom: 12 }}>Product History</Text>
        {productHistoryQ.data && productHistoryQ.data.length > 0 ? (
          <Card style={{ marginBottom: 12 }}>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Type</DataTable.Title>
                <DataTable.Title>Units</DataTable.Title>
                <DataTable.Title>Time</DataTable.Title>
                <DataTable.Title>Note</DataTable.Title>
              </DataTable.Header>
              {productHistoryQ.data.map((event) => (
                <DataTable.Row key={event.id}>
                  <DataTable.Cell>{event.type}</DataTable.Cell>
                  {event.deltaUnits ? (
                    <DataTable.Cell><Text variant="labelLarge" style={{color: event.deltaUnits > 0 ? 'green' : 'red'}}>{event.deltaUnits > 0 ? '+' : ''}{event.deltaUnits}</Text></DataTable.Cell>
                  ) : (
                    <DataTable.Cell>-</DataTable.Cell>
                  )}
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
            <Button onPress={handleConsumeItem} disabled={!consumtionDialogInfo}>Consume</Button>  
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={isDiscardDialogVisible} onDismiss={() => setIsDiscardDialogVisible(false)}>
          <Dialog.Title>Discard Expired</Dialog.Title>
          <Dialog.Content>
             <Text>Please discard the {packsQ.data?.filter(pack => pack.expiry && new Date(pack.expiry) < new Date()).length} expired pack{packsQ.data?.filter(pack => pack.expiry && new Date(pack.expiry) < new Date()).length !== 1 ? 's' : ''}</Text>
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
        ><Text>Took one unit of {productQ.data.name}</Text></Snackbar>
      </Portal>
    </AppWrapper>
  );
}
