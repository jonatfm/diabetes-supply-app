import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import LastConsumedItemCard from "@/components/LastConsumedItemCard";
import { useDatabase } from "@/db";
import { Pack, SESSION_OUTCOMES } from "@/db/schema";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useConsumeOneUnit } from "@/src/data/hooks/useConsumeOneUnit";
import { useEndSession } from "@/src/data/hooks/useEndSession";
import { useFetchPack } from "@/src/data/hooks/useFetchPack";
import { useGetActiveSession } from "@/src/data/hooks/useGetActiveSession";
import { useGetSessionOutcomeStatsByProduct } from "@/src/data/hooks/useGetSessionOutcomeStatsByProduct";
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
import { PieChart, pieDataItem } from "react-native-gifted-charts";
import { ActivityIndicator, Button, Card, Chip, DataTable, Dialog, Icon, Portal, RadioButton, SegmentedButtons, Snackbar, Text, useTheme } from "react-native-paper";

type PackColoredDots = {
  [packId: string]: string[];
};

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
  coloredDotIds?: string[];
}


const sessionStatusColors: Record<string, string> = {
  completed: "#81C784",      // green
  failed: "#E57373",         // red
  removed_early: "#F57C00",  // orange
  lost: "#9E9E9E",           // neutral / inactive (Material Grey 500)
  unknown: "#BDBDBD",        // lighter neutral / placeholder (Grey 400)
};

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
  const [lastConsumedPackId, setLastConsumedPackId] = useState<string | null>(null);
  const packsQ = usePacks(id);
  const productQ = useProduct(id);
  const productIdentifiersQ = useProductIdentifiers(id);
  const consumeMut = useConsumeOneUnit(id);
  const totalUnitsQ = useTotalUnitsByProduct(id);
  const productHistoryQ = useGetStockHistoryByProduct(id);
  const discardExpiredM = useHandleDiscardExpired(id);
  const undoLastTakeActionM = useUndoLastTakeActionFromProduct(id);
  const lastConsumedPackQ = useFetchPack(lastConsumedPackId ?? '');
  const getActiveSessionQ = useGetActiveSession(id);
  const endSessionM = useEndSession();
  const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;

  const getSessionOutcomeStatsByProductQ = useGetSessionOutcomeStatsByProduct(id);
  const [sessionOutcomePieData, setSessionOutcomePieData] = useState<pieDataItem[]>([]);

  const [isEndSessionDialogVisible, setIsEndSessionDialogVisible] = useState<boolean>(false);
  const [selectedSessionOutcome, setSelectedSessionOutcome] = useState<typeof SESSION_OUTCOMES[number]>('completed');
  const [consumeSortPreference, setConsumeSortPreference] = useState<'expiry' | 'fewest_units'>('expiry');
  const [anyPackHasColoredDots, setAnyPackHasColoredDots] = useState<boolean>(false);
  const [packColoredDots, setPackColoredDots] = useState<PackColoredDots>({});

  const isGS1 = productIdentifiersQ.data?.some(pi => pi.type === "GTIN") ?? false;
  const theme = useTheme();
  const router = useRouter();

  const historyEventColors: Record<string, string> = {
    "ADD": "green",
    "ADJUST": theme.colors.primary,
    "TAKE": "red",
    "UNDO": "orange"
  };

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

  useEffect(() => {
    if (productHistoryQ.data && productHistoryQ.data.length > 0) {
      const lastTakeEvent = productHistoryQ.data.find(event => event.type === "TAKE");
      if (lastTakeEvent?.packId) {
        setLastConsumedPackId(lastTakeEvent.packId);
      } else {
        setLastConsumedPackId(null);
      }
    } else {
      setLastConsumedPackId(null);
    }
  }, [productHistoryQ.data]);

  useEffect(() => {
    const checkColoredDots = async () => {
      if (!packsQ.data || !db || !coloredDotsEnabled) {
        setAnyPackHasColoredDots(false);
        setPackColoredDots({});
        return;
      }
      
      const dotsMap: PackColoredDots = {};
      let hasAny = false;
      
      for (const pack of packsQ.data) {
        if (pack.id) {
          const assignment = await coloredDotsRepo(db).getAssignmentByPackId(pack.id);
          if (assignment && assignment.dotIds) {
            dotsMap[pack.id] = assignment.dotIds;
            hasAny = true;
          }
        }
      }
      
      setPackColoredDots(dotsMap);
      setAnyPackHasColoredDots(hasAny);
    };

    checkColoredDots();
  }, [packsQ.data, db, coloredDotsEnabled]);

  useEffect(() => {
    if (!getSessionOutcomeStatsByProductQ.data) return;

    const pieData: pieDataItem[] = SESSION_OUTCOMES.map(outcome => {
      const percentage = getSessionOutcomeStatsByProductQ.data![outcome] / Object.values(getSessionOutcomeStatsByProductQ.data!).reduce((a, b) => a + b, 0) * 100;
      return {
        value: getSessionOutcomeStatsByProductQ.data![outcome] || 0,
        text:  percentage.toFixed(0) + '%',
        color: sessionStatusColors[outcome],
      }
    });
    setSessionOutcomePieData(pieData);
  }, [getSessionOutcomeStatsByProductQ.data]);

  const calculateChosenPack = async (sortPreference: 'expiry' | 'fewest_units'): Promise<ConsumtionDialogInfo | null> => {
    if (!packsQ.data) return null;
    
    // Never choose a pack that is expired
    const now = new Date();
    const validPacks = packsQ.data?.filter(pack => {
      if (!pack.expiry) return true;
      const expiryDate = new Date(pack.expiry);
      return expiryDate >= now;
    });

    if (validPacks.length === 0) {
      return null;
    }

    // Choose the pack based on sorting preference
    let chosenPack: Pack;
    if (sortPreference === 'expiry') {
      validPacks.sort((a, b) => {
        const aExpiry = a.expiry ? new Date(a.expiry).getTime() : Infinity;
        const bExpiry = b.expiry ? new Date(b.expiry).getTime() : Infinity;
        return aExpiry - bExpiry;
      });
    } else {
      // Sort by fewest units remaining
      validPacks.sort((a, b) => a.unitsRemaining - b.unitsRemaining);
    }
    chosenPack = validPacks[0];

    // Get identifier / serial for the dialog
    const identifier = chosenPack.ais && chosenPack.ais["21"] ? chosenPack.ais["21"] : (productIdentifiersQ.data?.[0]?.value || 'N/A');

    // Check colored dots
    let coloredDotIds: string[] | undefined = undefined;
    if (coloredDotsEnabled && productQ.data && productQ.data.useColoredDots && db) {
      coloredDotIds = (await coloredDotsRepo(db).getAssignmentByPackId(chosenPack.id))?.dotIds || [];
    }

    return {
      expiryDate: chosenPack.expiry ? new Date(chosenPack.expiry) : null,
      identifier,
      identifierType: chosenPack.ais && chosenPack.ais["21"] ? "Serial" : "Code",
      unitsLeftInPack: chosenPack.unitsRemaining,
      packId: chosenPack.id,
      coloredDotIds,
    };
  };

  const handlePressConsume = async () => {
    if (!packsQ.data) return;
    
    const chosenPackInfo = await calculateChosenPack(consumeSortPreference);
    
    if (!chosenPackInfo) {
      alert("No valid packs available to consume from.");
      return;
    }

    setConsumtionDialogInfo(chosenPackInfo);
    setIsConsumeDialogVisible(true);
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

  const handleStopSession = async () => {
    if (!getActiveSessionQ.data) return;

    await endSessionM.mutateAsync({
      sessionId: getActiveSessionQ.data.id,
      endedAt: new Date(),
      outcome: selectedSessionOutcome,
    });

    setIsEndSessionDialogVisible(false);
  }

  if (!dbReady || productQ.isPending) {
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
          <Text style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>Loading product...</Text>
        </View>
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
              {packsQ.data && packsQ.data.length === 0 && (
                <Chip icon={({size}) => <Icon source="alert" size={size} color={theme.colors.error} />} mode="flat" style={{ backgroundColor: theme.colors.errorContainer }}>
                  <Text variant="labelLarge" style={{ color: theme.colors.error }}>No packs available</Text>
                </Chip>
              )}
              {!!productQ.data.isSessionBased && (
                <Chip icon="timer-sand" mode="flat">
                  <Text variant="labelLarge">Session-based</Text>
                </Chip>
              )}
              {getActiveSessionQ.data && (
                <Chip icon={({size}) => <Icon source="hand-okay" size={size} color="#fff" />} mode="flat" style={{ backgroundColor: "#4caf50" }}>
                  <Text variant="labelLarge" style={{ color: "#fff" }}>Session active</Text>
                </Chip>
              )}
              <Chip icon="package" mode="flat">
                <Text variant="labelLarge">{totalUnitsQ.data} units in stock</Text>
              </Chip>
              {productQ.data.canHaveExpiry ? (
                <Chip icon="calendar-clock" mode="flat">
                  <Text variant="labelLarge">Expires</Text>
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
          {((packsQ.data && packsQ.data.length > 0) || (!!productQ.data.isSessionBased && getActiveSessionQ.data)) && (
            <>
              {(!productQ.data.isSessionBased || (!!productQ.data.isSessionBased && !getActiveSessionQ.data)) && (
                <Button 
                  mode="contained"
                  icon="needle"
                  onPress={handlePressConsume}
                >
                  Consume item
                </Button>
              )}
              {!!productQ.data.isSessionBased && getActiveSessionQ.data && (
                <Button
                  mode="contained"
                  icon="stop"
                  onPress={() => setIsEndSessionDialogVisible(true)}
                  buttonColor={theme.colors.error}
                  textColor={theme.colors.onError}
                >
                  Stop active session
                </Button>
              )}

              {productQ.data.canHaveExpiry && packsQ.data?.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) && (
                <Button
                  mode="outlined"
                  icon="delete"
                  onPress={() => setIsDiscardDialogVisible(true)}
                >
                  Discard expired packs
                </Button>
              )}
            </>
          )}
          {productQ.data && (
            <Button mode="outlined" icon="cog" onPress={() => router.push(`/product/settings/${productQ.data!.id}`)}>Settings</Button>
          )}
        </View>


        {/* Show a card with the current item active. It should only show when the products code is of gs1 type. The item shown here should be the one of the last TAKE event */}
        {isGS1 && lastConsumedPackQ.data && lastConsumedPackQ.data.ais && productIdentifiersQ.data?.some(pack => pack.type === "GTIN") && (() => {
          return (
            <View style={{ marginBottom: 12 }}>
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                <Text variant="titleLarge">Last consumed item</Text>
                <Button icon="eye" onPress={() => router.push(`/product/lastConsumedItem/${productQ.data!.id}`)}>See more</Button>
              </View>
              <LastConsumedItemCard productId={productQ.data!.id} packId={lastConsumedPackQ.data!.id} />
            </View>
          );
        })()}

        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
          <Text variant="titleLarge">Packs</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {productQ.data && productQ.data.id && packsQ.data && packsQ.data.length > 0 && (
              <Button icon="pencil" onPress={() => router.push(`/product/edit/${productQ.data!.id}`)}>Edit</Button>
            )}
          </View>
        </View>
        {packsQ.isPending ? (
          <Card style={{ marginBottom: 12 }}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                Loading packs...
              </Text>
            </Card.Content>
          </Card>
        ) : packsQ.data && productIdentifiersQ.data && (
          packsQ.data.length > 0 ? (() => {
            // Check if ANY pack has a serial number (ais["21"])
            const hasAnySerial = packsQ.data.some(pack => pack.ais && pack.ais["21"]);
            
            return (
            <Card style={{ marginBottom: 12 }}>
              <DataTable>
                <DataTable.Header>
                  {hasAnySerial ? (
                    <DataTable.Title>Serial</DataTable.Title>
                  ) : (
                    <DataTable.Title>Code</DataTable.Title>
                  )}
                  <DataTable.Title>Units left</DataTable.Title>
                  <DataTable.Title>Expiry</DataTable.Title>
                  {(anyPackHasColoredDots || !!productQ.data?.useColoredDots) && (
                    <DataTable.Title>Colored Dots</DataTable.Title>
                  )}
                </DataTable.Header>
                {packsQ.data.slice(from, to).map((pack) => (
                  <DataTable.Row key={pack.id} style={{ backgroundColor: pack.expiry && new Date(pack.expiry) < new Date() ? theme.colors.errorContainer : 'transparent' }}>
                    {hasAnySerial ? (
                      <DataTable.Cell>{pack.ais?.["21"] || '-'}</DataTable.Cell>
                    ) : (
                      <DataTable.Cell>{productIdentifiersQ.data[0]?.value.substring(0, 20) || '-'}</DataTable.Cell>
                    )}
                    <DataTable.Cell>{pack.unitsRemaining}</DataTable.Cell>
                    <DataTable.Cell>
                      {pack.expiry ? new Date(pack.expiry).toLocaleDateString() : '-'}
                    </DataTable.Cell>
                    {(anyPackHasColoredDots || !!productQ.data?.useColoredDots) && (
                      <DataTable.Cell>
                        {packColoredDots[pack.id] && packColoredDots[pack.id].length > 0 ? (
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {packColoredDots[pack.id].map((dotId, index) => (
                              <ColoredDot key={index} dotId={dotId} size={16} crossInactive={false} />
                            ))}
                          </View>
                        ) : (
                          <Text>-</Text>
                        )}
                      </DataTable.Cell>
                    )}
                      
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
            );
          })() : (
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

        <View style={{marginBottom: 12}}>
          <Text variant="titleLarge">Statistics</Text>
          <Card style={{marginTop: 12}}>
            <Card.Content>
              {!!productQ.data.isSessionBased && !!getSessionOutcomeStatsByProductQ.data && (
                <View style={{gap: 16}}>
                  <Text variant="bodyMedium">Session results</Text>
                  <View style={{flex: 1, flexDirection: "row"}}>
                    <PieChart
                      data={sessionOutcomePieData}
                      showText
                      textSize={20}
                      radius={70}
                      fontWeight="bold"
                      strokeWidth={2}
                      donut
                      innerCircleBorderWidth={2}
                      showValuesAsLabels
                      backgroundColor={theme.colors.elevation.level1}
                      strokeColor={theme.colors.inverseSurface}
                      centerLabelComponent={() => (
                        <Text variant="headlineMedium" style={{ fontWeight: 'bold' }}>
                          {Object.values(getSessionOutcomeStatsByProductQ.data!).reduce((a, b) => a + b, 0)}
                        </Text>
                      )}
                    />
                    <View style={{flex: 1, justifyContent: "space-between"}}>
                      {Object.entries(getSessionOutcomeStatsByProductQ.data).map(([outcome, count]) => (
                        <View key={outcome} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16}}>
                          <View style={{ width: 16, height: 16, backgroundColor: sessionStatusColors[outcome], marginRight: 8 }} />
                          <Text variant="bodyMedium" style={{ textTransform: 'capitalize' }}>
                            {outcome.replace("_", " ")}: {count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>

        <Text variant="titleLarge">Product History</Text>
        {productHistoryQ.isPending ? (
          <Card style={{ marginBottom: 12 }}>
            <Card.Content style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                Loading history...
              </Text>
            </Card.Content>
          </Card>
        ) : productHistoryQ.data && productHistoryQ.data.length > 0 ? (
          <>
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
                    <DataTable.Cell>
                      <Text variant="labelLarge" style={{ color: historyEventColors[event.type] || theme.colors.onSurface }}>{event.type}</Text>
                    </DataTable.Cell>
                    {event.deltaUnits ? (
                      <DataTable.Cell><Text variant="labelLarge" style={{color: event.deltaUnits > 0 ? 'green' : 'red'}}>{event.deltaUnits > 0 ? '+' : ''}{event.deltaUnits}</Text></DataTable.Cell>
                    ) : (
                      <DataTable.Cell>-</DataTable.Cell>
                    )}
                    <DataTable.Cell>{formatRelativeTime(event.occurredAt, now)}</DataTable.Cell>
                    <DataTable.Cell>{event.note || '-'}</DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </Card>
          </>
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
            <Text style={{ marginBottom: 12 }}>Sort packs by:</Text>
            <SegmentedButtons
              value={consumeSortPreference}
              onValueChange={async (value) => {
                const newPreference = value as 'expiry' | 'fewest_units';
                setConsumeSortPreference(newPreference);
                const newPackInfo = await calculateChosenPack(newPreference);
                if (newPackInfo) {
                  setConsumtionDialogInfo(newPackInfo);
                }
              }}
              buttons={[
                {
                  value: 'expiry',
                  label: 'Nearest expiry',
                  icon: 'calendar-clock',
                },
                {
                  value: 'fewest_units',
                  label: 'Fewest units',
                  icon: 'package-variant',
                },
              ]}
            />
            <Text style={{ marginTop: 16 }}>Please make sure to take exactly one unit from a pack with these <Text style={{ fontWeight: 'bold' }}>exact</Text> attributes:</Text>
            {consumtionDialogInfo ? (
              <View style={{ marginTop: 16 }}>
                <Text>{consumtionDialogInfo.identifierType}: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.identifier}</Text></Text>
                {consumtionDialogInfo.expiryDate && (
                  <Text>Expiry Date: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.expiryDate.toLocaleDateString()}</Text></Text>
                )}
                <Text>Units Left in Pack: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.unitsLeftInPack}</Text></Text>
                
                {consumtionDialogInfo.coloredDotIds && consumtionDialogInfo.coloredDotIds.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Text>Colored Dots:</Text>
                    <View style={{ flexDirection: 'row', marginLeft: 8, gap: 4 }}>
                      {consumtionDialogInfo.coloredDotIds.map((dotId, index) => (
                        <ColoredDot key={index} dotId={dotId} size={20} crossInactive={false} />
                      ))}
                    </View>
                  </View>
                )}
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

        <Dialog visible={isEndSessionDialogVisible} onDismiss={() => setIsEndSessionDialogVisible(false)}>
          <Dialog.Title>End Session</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to end the current session? This will allow you to start a new one.</Text>
            <Text>Please select an outcome for the session:</Text>
            <RadioButton.Group onValueChange={newValue => setSelectedSessionOutcome(newValue as typeof SESSION_OUTCOMES[number])} value={selectedSessionOutcome}>
              {SESSION_OUTCOMES.map((outcome) => (
                <RadioButton.Item
                  key={outcome}
                  value={outcome}
                  label={(outcome.charAt(0).toUpperCase() + outcome.slice(1)).replace("_", " ")}
                  color={theme.colors.primary}
                  labelVariant="bodyMedium"
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setIsEndSessionDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleStopSession} disabled={!selectedSessionOutcome}>End Session</Button>
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
