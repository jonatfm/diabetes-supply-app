import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import LastConsumedItemCard from "@/components/LastConsumedItemCard";
import { useDatabase } from "@/db";
import { Pack, SESSION_OUTCOMES } from "@/db/schema";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { holidayRepo } from "@/src/data/holidayRepo";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useConsumeOneUnit } from "@/src/data/hooks/useConsumeOneUnit";
import { useDaysUntilOutOfStock } from "@/src/data/hooks/useDaysUntilOutOfStock";
import { useEndSession } from "@/src/data/hooks/useEndSession";
import { useFetchPack } from "@/src/data/hooks/useFetchPack";
import { useGetActiveSession } from "@/src/data/hooks/useGetActiveSession";
import { useGetSessionOutcomeStatsByProduct } from "@/src/data/hooks/useGetSessionOutcomeStatsByProduct";
import { useGetStockHistoryByProduct } from "@/src/data/hooks/useGetStockHistoryByProduct";
import { useHandleDiscardExpired } from "@/src/data/hooks/useHandleDiscardExpired";
import { useIsProductOnActiveHoliday } from "@/src/data/hooks/useIsProductOnActiveHoliday";
import { usePacks } from "@/src/data/hooks/usePacks";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useProductIdentifiers } from "@/src/data/hooks/useProductIdentifiers";
import { useSessionStatistics } from "@/src/data/hooks/useSessionStatistics";
import { useTakeEventStatistics } from "@/src/data/hooks/useTakeEventStatistics";
import { useTotalUnitsByProduct } from "@/src/data/hooks/useTotalUnitsByProduct";
import { useUndoLastTakeActionFromProduct } from "@/src/data/hooks/useUndoLastTakeActionFromProduct";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { PieChart, pieDataItem } from "react-native-gifted-charts";
import { ActivityIndicator, Button, Card, Chip, DataTable, Dialog, Icon, Portal, ProgressBar, RadioButton, SegmentedButtons, Snackbar, Text, useTheme } from "react-native-paper";

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
  unitsOnHoliday?: number;
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
  const { isOnHoliday, hasActiveHoliday, activeHolidayId, activeHoliday, totalPackedUnits, packBreakdown, calculatedAmount } = useIsProductOnActiveHoliday(id);
  const consumeDisabledByHoliday = hasActiveHoliday && !isOnHoliday;
  
  const getSessionOutcomeStatsByProductQ = useGetSessionOutcomeStatsByProduct(id);
  const [sessionOutcomePieData, setSessionOutcomePieData] = useState<pieDataItem[]>([]);
  const daysUntilOOSQ = useDaysUntilOutOfStock(id);

  // Compute holiday packing details for the new card
  const holidayPackDetails = useMemo(() => {
    if (!isOnHoliday || !packsQ.data || packBreakdown.length === 0) return null;

    const packMap = new Map(packsQ.data.map(p => [p.id, p]));
    const items: { packId: string; packedUnits: number; unitsRemaining: number; expiry: number | null; serial: string | null }[] = [];
    let totalRemaining = 0;

    for (const bp of packBreakdown) {
      const pack = packMap.get(bp.packId);
      if (pack) {
        const remaining = Math.min(bp.packedUnits, pack.unitsRemaining);
        totalRemaining += remaining;
        items.push({
          packId: bp.packId,
          packedUnits: bp.packedUnits,
          unitsRemaining: remaining,
          expiry: pack.expiry ? new Date(pack.expiry).getTime() : null,
          serial: pack.ais?.["21"] ?? productIdentifiersQ.data?.[0]?.value ?? null,
        });
      }
    }

    const daysTotal = activeHoliday?.durationDays ?? 0;
    let estimatedDaysLeft: number | null = null;
    if (daysTotal > 0 && totalPackedUnits > 0) {
      const dailyRate = totalPackedUnits / daysTotal;
      estimatedDaysLeft = dailyRate > 0 ? totalRemaining / dailyRate : null;
    }

    return {
      items,
      totalPacked: totalPackedUnits,
      totalRemaining,
      totalUsed: totalPackedUnits - totalRemaining,
      estimatedDaysLeft,
      progress: totalPackedUnits > 0 ? totalRemaining / totalPackedUnits : 0,
      daysTotal,
      destination: activeHoliday?.destination ?? '',
      calculatedAmount,
    };
  }, [isOnHoliday, packsQ.data, packBreakdown, totalPackedUnits, activeHoliday, calculatedAmount, productIdentifiersQ.data]);
  const sessionStatsQ = useSessionStatistics(id);
  const takeEventStatsQ = useTakeEventStatistics(id);
  
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
  const [currentPacksPage, setCurrentPacksPage] = useState<number>(0);
  const packsPerPageDataTable = 5;
  const packsTableFrom = currentPacksPage * packsPerPageDataTable;
  const packsTableTo = Math.min((currentPacksPage + 1) * packsPerPageDataTable, packsQ.data?.length || 0);

  const [eventsCurrentPacksPage, setEventsCurrentPacksPage] = useState<number>(0);
  const eventsPerPageDataTable = 10;
  const eventsTableFrom = eventsCurrentPacksPage * eventsPerPageDataTable;
  const eventsTableTo = Math.min((eventsCurrentPacksPage + 1) * eventsPerPageDataTable, productHistoryQ.data?.length || 0);

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setCurrentPacksPage(0);
  }, [packsPerPageDataTable]);

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

  const calculateChosenPack = useCallback(async (sortPreference: 'expiry' | 'fewest_units'): Promise<ConsumtionDialogInfo | null> => {
    if (!packsQ.data || !db) return null;
    
    // When on an active holiday, only allow consuming from packs allocated to that holiday
    const onActiveHoliday = hasActiveHoliday && isOnHoliday && activeHolidayId;
    let holidayPackUnits: Record<string, number> = {};
    if (onActiveHoliday) {
      const packsForHol = await holidayRepo(db).getPacksForHoliday(activeHolidayId);
      for (const p of packsForHol) {
        holidayPackUnits[p.packId] = (holidayPackUnits[p.packId] ?? 0) + p.units;
      }
    }

    // Query holiday-reserved units per pack for this product
    const holidayReservedByPack = onActiveHoliday
      ? {} // skip regular reservation check; we use holiday allocation directly
      : await holidayRepo(db).getHolidayReservedUnitsByPack(id);

    // Never choose a pack that is expired
    const now = new Date();
    const validPacks = packsQ.data?.filter(pack => {
      if (!pack.expiry) return true;
      const expiryDate = new Date(pack.expiry);
      return expiryDate >= now;
    }).filter(pack => {
      if (onActiveHoliday) {
        // Only allow packs that are packed for this holiday with remaining allocation
        const allocatedUnits = holidayPackUnits[pack.id] ?? 0;
        return allocatedUnits > 0;
      }
      // Normal mode: only allow packs with at least 1 unit not reserved for a holiday
      const reserved = holidayReservedByPack[pack.id] ?? 0;
      return pack.unitsRemaining - reserved > 0;
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
    // use productQ.data here (hook value available earlier) instead of the later-declared `product` variable
    if (coloredDotsEnabled && productQ.data && productQ.data.useColoredDots && db) {
      coloredDotIds = (await coloredDotsRepo(db).getAssignmentByPackId(chosenPack.id))?.dotIds || [];
    }

    const unitsOnHoliday: number = holidayReservedByPack[chosenPack.id] ?? 0;

    return {
      expiryDate: chosenPack.expiry ? new Date(chosenPack.expiry) : null,
      identifier,
      identifierType: chosenPack.ais && chosenPack.ais["21"] ? "Serial" : "Code",
      unitsLeftInPack: chosenPack.unitsRemaining,
      packId: chosenPack.id,
      unitsOnHoliday: unitsOnHoliday > 0 ? unitsOnHoliday : undefined,
      coloredDotIds,
    };
  }, [packsQ.data, productIdentifiersQ.data, coloredDotsEnabled, productQ.data, db, id, hasActiveHoliday, isOnHoliday, activeHolidayId]);

  const handlePressConsume = useCallback(async () => {
    if (!packsQ.data) return;
    
    const chosenPackInfo = await calculateChosenPack(consumeSortPreference);
    
    if (!chosenPackInfo) {
      alert("No valid packs available to consume from.");
      return;
    }

    setConsumtionDialogInfo(chosenPackInfo);
    setIsConsumeDialogVisible(true);
  }, [packsQ.data, calculateChosenPack, consumeSortPreference]);

  const handleDiscardExpired = useCallback(async () => {
    await discardExpiredM.mutateAsync({productId: id});

    setIsDiscardDialogVisible(false);
  }, [discardExpiredM, id]);

  const handleConsumeItem = useCallback(async () => {
    if (!consumtionDialogInfo) return;
    
    await consumeMut.mutateAsync({packId: consumtionDialogInfo.packId});

    setIsConsumeDialogVisible(false);

    // Show snackbar with undo option
    setIsSnackbarVisible(true);
  }, [consumtionDialogInfo, consumeMut]);

  const handleUndoLastAction = useCallback(async () => {
    if (!db || !id || !consumtionDialogInfo) return;
    await undoLastTakeActionM.mutateAsync({productId: id});
  }, [db, id, consumtionDialogInfo, undoLastTakeActionM]);

  const handleStopSession = useCallback(async () => {
    if (!getActiveSessionQ.data) return;

    await endSessionM.mutateAsync({
      sessionId: getActiveSessionQ.data.id,
      endedAt: new Date(),
      outcome: selectedSessionOutcome,
    });

    setIsEndSessionDialogVisible(false);
  }, [getActiveSessionQ.data, endSessionM, selectedSessionOutcome]);

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
    );
  }

  // Ensure we have valid product data
  const product = productQ.data;

  return (
    <AppWrapper>
      <View style={{ marginBottom: 16 }}>
        <Button 
          mode="text" 
          onPress={() => router.back()} 
          icon="arrow-left"
          style={{ alignSelf: 'flex-start', marginLeft: -8 }}
        >
          Back
        </Button>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Card elevation={2} style={{ marginBottom: 24 }}>
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
              {product.canHaveExpiry && packsQ.data?.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) ? (
                <Chip icon={({size}) => <Icon source="alert" size={size} color={theme.colors.error} />} mode="flat" style={{ backgroundColor: theme.colors.errorContainer }}>
                  <Text variant="labelLarge" style={{ color: theme.colors.error }}>Has expired packs</Text>
                </Chip>
              ) : null}
              {packsQ.data && packsQ.data.length === 0 ? (
                <Chip icon={({size}) => <Icon source="alert" size={size} color={theme.colors.error} />} mode="flat" style={{ backgroundColor: theme.colors.errorContainer }}>
                  <Text variant="labelLarge" style={{ color: theme.colors.error }}>No packs available</Text>
                </Chip>
              ) : null}
              {!!product.isSessionBased ? (
                <Chip icon="timer-sand" mode="flat">
                  <Text variant="labelLarge">Session-based</Text>
                </Chip>
              ) : null}
              {getActiveSessionQ.data ? (
                <Chip icon={({size}) => <Icon source="hand-okay" size={size} color="#fff" />} mode="flat" style={{ backgroundColor: "#4caf50" }}>
                  <Text variant="labelLarge" style={{ color: "#fff" }}>Session active</Text>
                </Chip>
              ) : null}
              <Chip icon="package" mode="flat">
                <Text variant="labelLarge">{totalUnitsQ.data} units in stock</Text>
              </Chip>
              {daysUntilOOSQ.data?.estimatedDaysUntilOOS && totalUnitsQ.data && totalUnitsQ.data > 0 ? (
                <Chip 
                  icon="calendar-clock" 
                  mode="flat"
                  style={{
                    backgroundColor: daysUntilOOSQ.data.estimatedDaysUntilOOS < 7 
                      ? theme.colors.errorContainer 
                      : daysUntilOOSQ.data.estimatedDaysUntilOOS < 14 
                      ? '#fff8e1' 
                      : theme.colors.secondaryContainer
                  }}
                >
                  <Text variant="labelLarge" style={{
                    color: daysUntilOOSQ.data.estimatedDaysUntilOOS < 7 
                      ? theme.colors.error 
                      : daysUntilOOSQ.data.estimatedDaysUntilOOS < 14 
                      ? '#f57f17' 
                      : theme.colors.onSecondaryContainer
                  }}>
                    ~{daysUntilOOSQ.data.estimatedDaysUntilOOS.toFixed(0)} days left
                  </Text>
                </Chip>
              ) : null}
              {product.canHaveExpiry ? (
                <Chip icon="calendar-clock" mode="flat">
                  <Text variant="labelLarge">Expires</Text>
                </Chip>
              ) : null}
              {/*
              {isHolidayFunctionEnabled && product.requiredForHoliday ? (
                <Chip icon="beach" mode="flat">
                  <Text variant="labelLarge">Holiday Product</Text>
                </Chip>
              ) : null}
               */}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text variant="bodyMedium">
                Default units per pack: {product.unitsPerPackDefault}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                Status: {product.active ? 'Active' : 'Inactive'}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4 }}>
                {totalUnitsQ.data ?? 0} total units across {packsQ.data?.length} pack{packsQ.data?.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </Card.Content>
        </Card>
        
        <View style={{marginBottom: 24, gap: 8}}>
          {((packsQ.data && packsQ.data.length > 0) || (!!product.isSessionBased && getActiveSessionQ.data)) ? (
            <>
              {(!product.isSessionBased || (!!product.isSessionBased && !getActiveSessionQ.data)) ? (
                <Button 
                  mode="contained"
                  icon="needle"
                  onPress={handlePressConsume}
                  disabled={consumeDisabledByHoliday}
                >
                  {consumeDisabledByHoliday ? 'Not on current holiday' : 'Consume item'}
                </Button>
              ) : null}
              {!!product.isSessionBased && getActiveSessionQ.data ? (
                <Button
                  mode="contained"
                  icon="stop"
                  onPress={() => setIsEndSessionDialogVisible(true)}
                  buttonColor={theme.colors.error}
                  textColor={theme.colors.onError}
                >
                  Stop active session
                </Button>
              ) : null}

              {product.canHaveExpiry && packsQ.data?.some(pack => pack.expiry && new Date(pack.expiry) < new Date()) ? (
                <Button
                  mode="outlined"
                  icon="delete"
                  onPress={() => setIsDiscardDialogVisible(true)}
                >
                  Discard expired packs
                </Button>
              ) : null}
            </>
          ) : null}
          {product ? (
            <Button mode="outlined" icon="cog" onPress={() => router.push(`/product/settings/${product.id}`)}>Settings</Button>
          ) : null}
        </View>


        {/* Holiday Packing Card */}
        {holidayPackDetails && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Icon source="bag-suitcase" size={24} color={theme.colors.primary} />
              <Text variant="titleLarge">Holiday Packing</Text>
            </View>
            <Card mode="elevated" elevation={2}>
              <Card.Content>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Icon source="map-marker" size={20} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                    {holidayPackDetails.destination}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    ({holidayPackDetails.daysTotal} days)
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text variant="bodyMedium">
                    {holidayPackDetails.totalRemaining} of {holidayPackDetails.totalPacked} units remaining
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                    {holidayPackDetails.totalUsed} used
                  </Text>
                </View>
                <ProgressBar
                  progress={holidayPackDetails.progress}
                  color={holidayPackDetails.progress < 0.2 ? theme.colors.error : theme.colors.primary}
                  style={{ height: 6, borderRadius: 3, marginBottom: 8 }}
                />
                {holidayPackDetails.estimatedDaysLeft !== null && (
                  <Text variant="bodyMedium" style={{ color: holidayPackDetails.estimatedDaysLeft < 2 ? theme.colors.error : theme.colors.onSurface, marginBottom: 12 }}>
                    ~{holidayPackDetails.estimatedDaysLeft.toFixed(1)} days of holiday supply remaining
                  </Text>
                )}

                {holidayPackDetails.items.length > 0 && (
                  <DataTable>
                    <DataTable.Header>
                      <DataTable.Title>Pack</DataTable.Title>
                      <DataTable.Title>Packed</DataTable.Title>
                      <DataTable.Title>Left</DataTable.Title>
                      <DataTable.Title>Expiry</DataTable.Title>
                    </DataTable.Header>
                    {holidayPackDetails.items.map((item) => (
                      <DataTable.Row key={item.packId}>
                        <DataTable.Cell>
                          {item.serial
                          ? item.serial.length > 8
                            ? `${item.serial.slice(0, 4)}...${item.serial.slice(-4)}`
                            : item.serial
                          : '-'
                          }
                        </DataTable.Cell>
                        <DataTable.Cell>{item.packedUnits}</DataTable.Cell>
                        <DataTable.Cell>
                          <Text style={{ color: item.unitsRemaining === 0 ? theme.colors.error : theme.colors.onSurface }}>
                            {item.unitsRemaining}
                          </Text>
                        </DataTable.Cell>
                        <DataTable.Cell>{item.expiry ? new Date(item.expiry).toLocaleDateString() : '-'}</DataTable.Cell>
                      </DataTable.Row>
                    ))}
                  </DataTable>
                )}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Show a card with the current item active. It should only show when the products code is of gs1 type. The item shown here should be the one of the last TAKE event */}
        {isGS1 && lastConsumedPackQ.data && lastConsumedPackQ.data.ais && productIdentifiersQ.data?.some(pack => pack.type === "GTIN") ? (() => {
          return (
            <View style={{ marginBottom: 12 }}>
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
                <Text variant="titleLarge">Last consumed item</Text>
                <Button icon="eye" onPress={() => router.push(`/product/lastConsumedItem/${product.id}`)}>See more</Button>
              </View>
              <LastConsumedItemCard productId={product.id} packId={lastConsumedPackQ.data!.id} />
            </View>
          );
        })() : null}

        <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
          <Text variant="titleLarge">Packs</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {product && product.id && packsQ.data && packsQ.data.length > 0 ? (
              <Button icon="pencil" onPress={() => router.push(`/product/edit/${product.id}`)}>Edit</Button>
            ) : null}
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
        ) : packsQ.data && productIdentifiersQ.data ? (
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
                  {(anyPackHasColoredDots || !!product?.useColoredDots) ? (
                    <DataTable.Title>Colored Dots</DataTable.Title>
                  ) : null}
                </DataTable.Header>
                {packsQ.data.slice(packsTableFrom, packsTableTo).map((pack) => (
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
                    {(anyPackHasColoredDots || !!product?.useColoredDots) ? (
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
                    ) : null}
                      
                  </DataTable.Row>
                ))}

                <DataTable.Pagination
                  page={currentPacksPage}
                  numberOfPages={Math.ceil(packsQ.data.length / packsPerPageDataTable)}
                  onPageChange={(page) => setCurrentPacksPage(page)}
                  label={`${packsTableFrom + 1}-${packsTableTo} of ${packsQ.data.length}`}
                  numberOfItemsPerPage={packsPerPageDataTable}
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
        ) : null}

        <View style={{marginBottom: 12}}>
          <Text variant="titleLarge">Statistics</Text>
          
          {/* Key Metrics Card */}
          <Card style={{marginTop: 12, marginBottom: 12}}>
            <Card.Content>
              <View style={{ gap: 16 }}>
                {/* Days until out of stock */}
                {daysUntilOOSQ.data?.estimatedDaysUntilOOS && totalUnitsQ.data && totalUnitsQ.data > 0 ? (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Icon source="clock-alert-outline" size={24} color={theme.colors.primary} />
                      <Text variant="titleMedium" style={{ marginLeft: 8 }}>Days Until Out of Stock</Text>
                    </View>
                    <Text variant="headlineLarge" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
                      ~{daysUntilOOSQ.data.estimatedDaysUntilOOS.toFixed(1)} days
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.secondary, marginTop: 4 }}>
                      Based on {daysUntilOOSQ.data.isSessionBased ? 'session patterns' : 'consumption rate'}
                    </Text>
                  </View>
                ) : null}

                {!daysUntilOOSQ.data?.estimatedDaysUntilOOS && totalUnitsQ.data && totalUnitsQ.data > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                    <Icon source="information-outline" size={20} color={theme.colors.secondary} />
                    <Text variant="bodySmall" style={{ marginLeft: 8, color: theme.colors.secondary, flex: 1 }}>
                      Not enough data to estimate. Need at least 2 {daysUntilOOSQ.data?.isSessionBased ? 'completed sessions' : 'TAKE events'}.
                    </Text>
                  </View>
                ) : null}

                {/* Consumption Rate for non-session-based */}
                {!product?.isSessionBased && takeEventStatsQ.data ? (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Icon source="chart-line" size={24} color={theme.colors.tertiary} />
                      <Text variant="titleMedium" style={{ marginLeft: 8 }}>Consumption Rate</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                      <View>
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>Average Time Between Uses</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                          {takeEventStatsQ.data.averageDays.toFixed(1)} days
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.colors.secondary }}>
                          ({takeEventStatsQ.data.averageHours.toFixed(1)} hours)
                        </Text>
                      </View>
                      <View>
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>Total Events</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                          {takeEventStatsQ.data.eventCount}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {/* Session Statistics for session-based */}
                {product?.isSessionBased && sessionStatsQ.data ? (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Icon source="timer-outline" size={24} color={theme.colors.tertiary} />
                      <Text variant="titleMedium" style={{ marginLeft: 8 }}>Session Patterns</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                      <View>
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>Avg Session Duration</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                          {sessionStatsQ.data.averageSessionDurationDays.toFixed(1)} days
                        </Text>
                      </View>
                      <View>
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>Avg Time Between</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                          {sessionStatsQ.data.averageTimeBetweenSessionsDays.toFixed(1)} days
                        </Text>
                      </View>
                      <View>
                        <Text variant="labelSmall" style={{ color: theme.colors.secondary }}>Completed Sessions</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>
                          {sessionStatsQ.data.totalCompletedSessions}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            </Card.Content>
          </Card>

          {/* Session Outcomes Chart for session-based products */}
          {!!product?.isSessionBased && !!getSessionOutcomeStatsByProductQ.data && Object.values(getSessionOutcomeStatsByProductQ.data).reduce((a, b) => a + b, 0) > 0 ? (
            <Card style={{marginTop: 12}}>
              <Card.Content>
                <View style={{gap: 16}}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Icon source="chart-donut" size={24} color={theme.colors.primary} />
                    <Text variant="titleMedium" style={{ marginLeft: 8 }}>Session Outcomes</Text>
                  </View>
                  <View style={{flex: 1, flexDirection: "row", alignItems: 'center'}}>
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
                    <View style={{flex: 1, justifyContent: "center", marginLeft: 16}}>
                      {Object.entries(getSessionOutcomeStatsByProductQ.data).map(([outcome, count]) => 
                        count > 0 ? (
                          <View key={outcome} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                            <View style={{ width: 16, height: 16, backgroundColor: sessionStatusColors[outcome], marginRight: 8, borderRadius: 2 }} />
                            <Text variant="bodyMedium" style={{ textTransform: 'capitalize' }}>
                              {outcome.replace("_", " ")}: {count}
                            </Text>
                          </View>
                        ) : null
                      )}
                    </View>
                  </View>
                </View>
              </Card.Content>
            </Card>
          ) : null}
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
                {productHistoryQ.data.slice(eventsTableFrom, eventsTableTo).map((event) => (
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

                <DataTable.Pagination
                  page={eventsCurrentPacksPage}
                  numberOfPages={Math.ceil(productHistoryQ.data.length / eventsPerPageDataTable)}
                  onPageChange={(page) => setEventsCurrentPacksPage(page)}
                  label={`${eventsTableFrom + 1}-${eventsTableTo} of ${productHistoryQ.data.length}`}
                  numberOfItemsPerPage={eventsPerPageDataTable}
                  showFastPaginationControls
                  selectPageDropdownLabel={'Packs per page'}
                />
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
                {consumtionDialogInfo.expiryDate ? (
                  <Text>Expiry Date: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.expiryDate.toLocaleDateString()}</Text></Text>
                ) : null}
                <Text>Units Left in Pack: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{consumtionDialogInfo.unitsLeftInPack}</Text></Text>
                
                {consumtionDialogInfo.unitsOnHoliday ? (
                  <Text>Units on holiday: <Text style={{ fontWeight: 'bold', color: theme.colors.tertiary }}>{consumtionDialogInfo.unitsOnHoliday}</Text></Text>
                ) : null}
                
                {consumtionDialogInfo.coloredDotIds && consumtionDialogInfo.coloredDotIds.length > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                    <Text>Colored Dots:</Text>
                    <View style={{ flexDirection: 'row', marginLeft: 8, gap: 4 }}>
                      {consumtionDialogInfo.coloredDotIds.map((dotId, index) => (
                        <ColoredDot key={index} dotId={dotId} size={20} crossInactive={false} />
                      ))}
                    </View>
                  </View>
                ) : null}
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
        ><Text>Took one unit of {product.name}</Text></Snackbar>
      </Portal>
    </AppWrapper>
  );
}
