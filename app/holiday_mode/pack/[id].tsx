import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import { db, useDatabase } from "@/db";
import { Holiday, Pack } from "@/db/schema";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { holidayRepo } from "@/src/data/holidayRepo";
import { useAddPackToHoliday } from "@/src/data/hooks/useAddPackToHoliday";
import { useActivateHoliday } from "@/src/data/hooks/useActivateHoliday";
import { useActiveHoliday } from "@/src/data/hooks/useActiveHoliday";
import { useAppSetting } from "@/src/data/hooks/useAppSetting";
import { useGetPacksForHoliday } from "@/src/data/hooks/useGetPacksForHoliday";
import { useHoliday } from "@/src/data/hooks/useHoliday";
import { useProduct } from "@/src/data/hooks/useProduct";
import { useProductIdentifiers } from "@/src/data/hooks/useProductIdentifiers";
import { packsRepo } from "@/src/data/packsRepo";
import { qk } from "@/src/data/queryKeys";
import { calculateHolidayNeeds, calculateHolidayNeedsSimple, HolidayNeedsResult, HolidayNeedsSimpleResult } from "@/src/utils/calculateHolidayNeeds";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageBackground, Pressable, useWindowDimensions, View } from "react-native";
import { Button, Card, Dialog, Icon, Portal, Snackbar, Text, useTheme } from "react-native-paper";

export default function PackForHoliday() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { db: hookDb } = useDatabase();
    const {width} = useWindowDimensions();
    const theme = useTheme();
    const router = useRouter();
    const qc = useQueryClient();
    const holiday = useHoliday(id);
    const packsForHoliday = useGetPacksForHoliday(id);
    const activeHolidayQ = useActiveHoliday();
    const activateHolidayM = useActivateHoliday();
    const [holidayNeedsSimple, setHolidayNeedsSimple] = useState<HolidayNeedsSimpleResult[]>([]);
    const [isPackItemDialogVisible, setIsPackItemDialogVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [isMarkPackedDialogVisible, setIsMarkPackedDialogVisible] = useState(false);
    const [screenError, setScreenError] = useState<string | null>(null);
    const isAutoFinishingRef = useRef(false);

    // Calculate responsive grid layout
    // Account for AppWrapper padding (typically 16px on each side) and Card.Content padding (16px on each side)
    const containerPadding = 64; // Total horizontal padding from all containers
    const availableWidth = width - containerPadding;
    
    // Responsive breakpoints optimized for phones
    const columns = availableWidth < 300 ? 2 : availableWidth < 500 ? 2 : availableWidth < 800 ? 3 : 4;
    const gap = availableWidth < 300 ? 8 : 12;
    const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

    useEffect(() => {
        if (!holiday.data) return;
        calculateHolidayNeedsSimple(holiday.data).then(setHolidayNeedsSimple);
    }, [holiday.data]);

    // Derive packed units per product directly from persisted records
    const packedUnitsByProduct = useMemo(() => packsForHoliday.data?.reduce((acc, packed) => {
        if (packed.productId) {
            acc[packed.productId] = (acc[packed.productId] || 0) + packed.originalUnits;
        }
        return acc;
    }, {} as Record<string, number>) ?? {}, [packsForHoliday.data]);

    const handleItemPress = (item: HolidayNeedsSimpleResult) => {
        setSelectedProduct(item.product.id);
        setIsPackItemDialogVisible(true);
    }

    const accentColor = holiday.data?.state === "ACTIVE" ? theme.colors.onPrimaryContainer : theme.colors.primary;

    // Compute which products are under-packed for the warning dialog
    const underPackedItems = holidayNeedsSimple.filter(item => {
        const packed = packedUnitsByProduct[item.product.id] || 0;
        return packed < item.calculatedAmount;
    });
    const totalPackedUnits = Object.values(packedUnitsByProduct).reduce((sum, units) => sum + units, 0);
    const isEverythingPacked = holidayNeedsSimple.length > 0 && underPackedItems.length === 0 && totalPackedUnits > 0;

    const handleMarkAsPacked = async () => {
        if (!hookDb || !holiday.data) return;
        try {
            await holidayRepo(hookDb).markHolidayPacked(holiday.data.id);
            await qc.invalidateQueries({ queryKey: qk.holidays() });
            await qc.invalidateQueries({ queryKey: qk.holiday(holiday.data.id) });
            setIsMarkPackedDialogVisible(false);
            router.back();
        } catch (error) {
            setScreenError(error instanceof Error ? error.message : "The trip could not be marked as packed.");
        }
    };

    useEffect(() => {
        if (!hookDb || !holiday.data || holiday.data.state !== "PLANNED" || !isEverythingPacked || isAutoFinishingRef.current) return;

        isAutoFinishingRef.current = true;
        holidayRepo(hookDb).markHolidayPacked(holiday.data.id)
            .then(async () => {
                await Promise.all([
                    qc.invalidateQueries({ queryKey: qk.holidays() }),
                    qc.invalidateQueries({ queryKey: qk.holiday(holiday.data!.id) }),
                ]);
            })
            .catch((error) => {
                setScreenError(error instanceof Error ? error.message : "The trip could not be marked as packed.");
            })
            .finally(() => {
                isAutoFinishingRef.current = false;
            });
    }, [hookDb, holiday.data, isEverythingPacked, qc]);

    const handleStartTrip = async () => {
        if (!holiday.data) return;
        if (activeHolidayQ.data && activeHolidayQ.data.id !== holiday.data.id) {
            setScreenError(`End the ongoing trip to ${activeHolidayQ.data.destination} before starting another trip.`);
            return;
        }
        try {
            await activateHolidayM.mutateAsync(holiday.data.id);
            router.back();
        } catch (error) {
            setScreenError(error instanceof Error ? error.message : "The trip could not be started.");
        }
    };

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
            <View>
                <Text variant="headlineLarge" style={{marginBottom: 24}}>
                    Pack for <Text style={{color: theme.colors.primary}}>{holiday.data?.destination}</Text>
                </Text>
                
                <Card style={{marginBottom: 16}}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{marginBottom: 8}}>Packing list</Text>
                        <Text variant="bodyMedium" style={{marginBottom: 16}}>Press an item to see what exactly is needed</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: "flex-start", gap: gap}}>
                            {holidayNeedsSimple.map((item, index) => (
                                <Pressable onPress={() => handleItemPress(item)} 
                                    key={item.product.id} 
                                    style={{
                                        width: itemWidth, 
                                        aspectRatio: 1/1, 
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                    }}
                                >
                                    <ImageBackground 
                                        source={item.product.imageUri ? { uri: item.product.imageUri } : undefined}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            justifyContent: 'space-between',
                                        }}
                                        imageStyle={{ borderRadius: 12 }}
                                    >
                                        <View 
                                            style={{
                                                flex: 1,
                                                backgroundColor: item.product.imageUri 
                                                    ? (packedUnitsByProduct[item.product.id] || 0) < item.calculatedAmount ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.5)'
                                                    : theme.colors.surfaceVariant,
                                                padding: 12,
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <Text 
                                                variant="labelMedium" 
                                                style={{
                                                    color: item.product.imageUri 
                                                        ? '#ffffff' 
                                                        : accentColor,
                                                    textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                                    textShadowOffset: { width: 0, height: 1 },
                                                    textShadowRadius: 3,
                                                }}
                                                numberOfLines={2}
                                            >
                                                {item.product.name}
                                            </Text>
                                            <Text 
                                                variant="bodyLarge" 
                                                style={{
                                                    color: item.product.imageUri 
                                                        ? '#ffffff' 
                                                        : theme.colors.onSurface,
                                                    fontWeight: 'bold',
                                                    fontSize: 18,
                                                    textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                                    textShadowOffset: { width: 0, height: 1 },
                                                    textShadowRadius: 3,
                                                }}
                                            >
                                                {packedUnitsByProduct[item.product.id] || 0} / {item.calculatedAmount}
                                            </Text>
                                        </View>
                                        {(packedUnitsByProduct[item.product.id] || 0) >= item.calculatedAmount && (
                                            <View style={{position: "absolute", left: "50%", top: "50%", transform: [{ translateX: -24 }, { translateY: -24 }]}}>
                                                <Icon source="check-circle" size={48} color={theme.colors.primary} />
                                            </View>
                                        )}
                                    </ImageBackground>
                                </Pressable>
                            ))}
                        </View>
                    </Card.Content>
                </Card>

                {holiday.data?.state === "PLANNED" && !isEverythingPacked && (
                    <Button
                        mode="contained"
                        icon="check-all"
                        style={{ marginBottom: 16 }}
                        onPress={() => setIsMarkPackedDialogVisible(true)}
                    >
                        Confirm packed & ready
                    </Button>
                )}
                {holiday.data?.state === "PACKED" && (
                    <Card mode="contained" style={{ marginBottom: 16 }}>
                        <Card.Content>
                            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>Trip confirmed as packed</Text>
                            <Text variant="bodyMedium" style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
                                Everything is ready. Start the trip when you leave.
                            </Text>
                            <Button
                                icon="airplane-takeoff"
                                mode="contained"
                                style={{ marginTop: 16 }}
                                onPress={handleStartTrip}
                                loading={activateHolidayM.isPending}
                                disabled={activateHolidayM.isPending}
                            >
                                Start trip
                            </Button>
                        </Card.Content>
                    </Card>
                )}
            </View>

            <Portal>
                {holiday.data && (
                    <PackItemsDialog
                        visible={isPackItemDialogVisible && selectedProduct !== null}
                        onDismiss={() => setIsPackItemDialogVisible(false)}
                        productId={selectedProduct!}
                        holiday={holiday.data}
                    />
                )}
                <Dialog visible={isMarkPackedDialogVisible} onDismiss={() => setIsMarkPackedDialogVisible(false)}>
                    <Dialog.Title>Finish packing?</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 12 }}>
                            This keeps the selected units reserved and enables Start trip on the Trips screen.
                        </Text>
                        {underPackedItems.length > 0 && <Text style={{ marginBottom: 12 }}>These items are still below their planned amount:</Text>}
                        {underPackedItems.map(item => {
                            const packed = packedUnitsByProduct[item.product.id] || 0;
                            return (
                                <Text key={item.product.id} style={{ color: theme.colors.error }}>
                                    {item.product.name}: {packed} / {item.calculatedAmount} units
                                </Text>
                            );
                        })}
                        {underPackedItems.length > 0 && <Text style={{ marginTop: 12 }}>You can still confirm, but you may run out of supplies. Repack later to change allocations.</Text>}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsMarkPackedDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleMarkAsPacked} disabled={!hookDb}>Finish packing</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            <Snackbar visible={screenError !== null} onDismiss={() => setScreenError(null)} duration={5000}>
                {screenError}
            </Snackbar>
        </AppWrapper>
    )
}

function PackItemsDialog({ visible, onDismiss, productId, holiday }: { visible: boolean; onDismiss: () => void; productId: string; holiday: Holiday }) {
    const { db: hookDb } = useDatabase();
    const theme = useTheme();
    const packsForHoliday = useGetPacksForHoliday(holiday.id);
    const product = useProduct(productId);
    const productIdentifiersQ = useProductIdentifiers(productId);
    const coloredDotsEnabled = useAppSetting("coloredDotsEnabled").data ?? false;
    const [holidayNeeds, setHolidayNeeds] = useState<HolidayNeedsResult[]>([]);
    const [currentSelectedPack, setCurrentSelectedPack] = useState<Pack|null>(null);
    const [unitsToTake, setUnitsToTake] = useState<number>(0);
    const [coloredDotIds, setColoredDotIds] = useState<string[]>([]);
    const [reservedByOtherHolidays, setReservedByOtherHolidays] = useState<number>(0);
    const [packError, setPackError] = useState<string | null>(null);
    const addPackToHolidayM = useAddPackToHoliday();
    
    useEffect(() => {
        async function fetchNeeds() {
            if (!visible) return;
            const needs = await calculateHolidayNeeds(holiday);
            setHolidayNeeds(needs);
        }
        fetchNeeds();
    }, [holiday, packsForHoliday.data, visible]);
    
    useEffect(() => {
        async function fetchCurrentPack() {
            if (holidayNeeds.length === 0) {
                setCurrentSelectedPack(null);
                setUnitsToTake(0);
                return;
            }
            const need = holidayNeeds.find(n => n.product.id === productId);
            if (!need || need.packs.length === 0) {
                setCurrentSelectedPack(null);
                setUnitsToTake(0);
                return;
            }
            const packEntry = need.packs[0];
            const pack = await packsRepo(db).fetchPackById(packEntry.packId);
            setCurrentSelectedPack(pack);
            setUnitsToTake(packEntry.units);
        }
        fetchCurrentPack();
    }, [holidayNeeds, productId]);

    // Fetch colored dots for the selected pack
    useEffect(() => {
        async function fetchColoredDots() {
            if (!currentSelectedPack || !hookDb || !coloredDotsEnabled || !product.data?.useColoredDots) {
                setColoredDotIds([]);
                return;
            }
            const assignment = await coloredDotsRepo(hookDb).getAssignmentByPackId(currentSelectedPack.id);
            setColoredDotIds(assignment?.dotIds ?? []);
        }
        fetchColoredDots();
    }, [currentSelectedPack, hookDb, coloredDotsEnabled, product.data?.useColoredDots]);

    // Check how many units from this pack are reserved by OTHER holidays
    useEffect(() => {
        async function fetchOtherReservations() {
            if (!currentSelectedPack || !hookDb) {
                setReservedByOtherHolidays(0);
                return;
            }
            const reservedByPack = await holidayRepo(hookDb).getHolidayReservedUnitsByPack(
                productId,
                holiday.id, // exclude current holiday
            );
            setReservedByOtherHolidays(reservedByPack[currentSelectedPack.id] ?? 0);
        }
        fetchOtherReservations();
    }, [currentSelectedPack, hookDb, productId, holiday.id]);

    const pack = async () => {
        if (!currentSelectedPack) return;
        try {
            await addPackToHolidayM.mutateAsync({
                holidayId: holiday.id,
                packId: currentSelectedPack.id,
                units: unitsToTake,
            });
            onDismiss();
        } catch (error) {
            setPackError(error instanceof Error ? error.message : "The units could not be packed.");
        }
    }

    // Derive identifier info from the pack
    const identifier = currentSelectedPack?.ais?.["21"]
        ? currentSelectedPack.ais["21"]
        : (productIdentifiersQ.data?.[0]?.value || 'N/A');
    const identifierType = currentSelectedPack?.ais?.["21"] ? "Serial" : "Code";

    return (
        <Dialog visible={visible} onDismiss={onDismiss}>
            <Dialog.Title>{product.data?.name}</Dialog.Title>
            <Dialog.Content>
                {currentSelectedPack ? (
                    <View>
                        <Text>Please make sure to take exactly <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{unitsToTake} unit{unitsToTake !== 1 ? 's' : ''}</Text> from a pack with these <Text style={{ fontWeight: 'bold' }}>exact</Text> attributes:</Text>
                        <View style={{ marginTop: 16 }}>
                            <Text>{identifierType}: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{identifier}</Text></Text>
                            {currentSelectedPack.expiry ? (
                                <Text>Expiry Date: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{new Date(currentSelectedPack.expiry).toLocaleDateString()}</Text></Text>
                            ) : null}
                            <Text>Units Left in Pack: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{currentSelectedPack.unitsRemaining}</Text></Text>
                            {reservedByOtherHolidays > 0 ? (
                                <Text>Reserved for other trips: <Text style={{ fontWeight: 'bold', color: theme.colors.tertiary }}>{reservedByOtherHolidays}</Text></Text>
                            ) : null}
                            {coloredDotIds.length > 0 ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                                    <Text>Colored Dots:</Text>
                                    <View style={{ flexDirection: 'row', marginLeft: 8, gap: 4 }}>
                                        {coloredDotIds.map((dotId, index) => (
                                            <ColoredDot key={index} dotId={dotId} size={20} crossInactive={false} />
                                        ))}
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    </View>
                ) : (
                    <Text>No available units remain for this product.</Text>
                )}
                {packError && <Text style={{ marginTop: 12, color: theme.colors.error }}>{packError}</Text>}
            </Dialog.Content>
            <Dialog.Actions>
                <Button onPress={onDismiss}>Close</Button>
                <Button onPress={pack} disabled={!currentSelectedPack || addPackToHolidayM.isPending} loading={addPackToHolidayM.isPending}>Pack and Continue</Button>
            </Dialog.Actions>
        </Dialog>
    )
}
