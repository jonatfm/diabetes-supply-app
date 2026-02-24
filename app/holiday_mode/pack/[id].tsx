import AppWrapper from "@/components/AppWrapper";
import ColoredDot from "@/components/ColoredDot";
import { db, useDatabase } from "@/db";
import { Holiday, Pack } from "@/db/schema";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { holidayRepo } from "@/src/data/holidayRepo";
import { useAddPackToHoliday } from "@/src/data/hooks/useAddPackToHoliday";
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
import { useEffect, useState } from "react";
import { ImageBackground, Pressable, useWindowDimensions, View } from "react-native";
import { Button, Card, Dialog, Icon, Portal, Text, useTheme } from "react-native-paper";

export default function PackForHoliday() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { db: hookDb } = useDatabase();
    const {width} = useWindowDimensions();
    const theme = useTheme();
    const router = useRouter();
    const qc = useQueryClient();
    const holiday = useHoliday(id);
    const packsForHoliday = useGetPacksForHoliday(id);
    const [holidayNeedsSimple, setHolidayNeedsSimple] = useState<HolidayNeedsSimpleResult[]>([]);
    const [isPackItemDialogVisible, setIsPackItemDialogVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [isMarkPackedDialogVisible, setIsMarkPackedDialogVisible] = useState(false);

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
    const packedUnitsByProduct = packsForHoliday.data?.reduce((acc, packed) => {
        if (packed.productId) {
            acc[packed.productId] = (acc[packed.productId] || 0) + packed.units;
        }
        return acc;
    }, {} as Record<string, number>) ?? {};

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

    const handleMarkAsPacked = async () => {
        if (!hookDb || !holiday.data) return;
        await holidayRepo(hookDb).updateHolidayState(holiday.data.id, "PACKED");
        await qc.invalidateQueries({ queryKey: qk.holidays() });
        holiday.refetch();
        setIsMarkPackedDialogVisible(false);
        router.back();
    };

    // Auto-mark holiday as PACKED when every product meets its target
    useEffect(() => {
        if (
            !hookDb ||
            !holiday.data ||
            holiday.data.state !== "PLANNED" ||
            holidayNeedsSimple.length === 0 ||
            !packsForHoliday.data
        ) return;

        const allPacked = holidayNeedsSimple.every(item => {
            const packed = packedUnitsByProduct[item.product.id] || 0;
            return packed >= item.calculatedAmount;
        });

        if (allPacked) {
            holidayRepo(hookDb).updateHolidayState(holiday.data.id, "PACKED").then(() => {
                qc.invalidateQueries({ queryKey: qk.holidays() });
                holiday.refetch();
            });
        }
    }, [packsForHoliday.data, holidayNeedsSimple, holiday.data, hookDb]);

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

                {holiday.data?.state === "PLANNED" && (
                    <Button
                        mode="contained"
                        icon="check-all"
                        style={{ marginBottom: 16 }}
                        onPress={() => {
                            if (underPackedItems.length > 0) {
                                setIsMarkPackedDialogVisible(true);
                            } else {
                                handleMarkAsPacked();
                            }
                        }}
                    >
                        Mark as packed
                    </Button>
                )}
                {holiday.data?.state === "PACKED" && (
                    <Text variant="titleLarge" style={{ color: theme.colors.primary, textAlign: "center" }}>Holiday is packed!</Text>
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
                    <Dialog.Title>Not fully packed</Dialog.Title>
                    <Dialog.Content>
                        <Text style={{ marginBottom: 12 }}>The following items have not been packed adequately:</Text>
                        {underPackedItems.map(item => {
                            const packed = packedUnitsByProduct[item.product.id] || 0;
                            return (
                                <Text key={item.product.id} style={{ color: theme.colors.error }}>
                                    {item.product.name}: {packed} / {item.calculatedAmount} units
                                </Text>
                            );
                        })}
                        <Text style={{ marginTop: 12 }}>Are you sure you want to mark this holiday as packed anyway? You may run out of supplies.</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsMarkPackedDialogVisible(false)}>Cancel</Button>
                        <Button textColor={theme.colors.error} onPress={handleMarkAsPacked}>Mark as packed</Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
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
        await addPackToHolidayM.mutateAsync({
            holidayId: holiday.id,
            packId: currentSelectedPack.id,
            units: unitsToTake,
        });
        onDismiss();
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
                                <Text>Reserved for other holidays: <Text style={{ fontWeight: 'bold', color: theme.colors.tertiary }}>{reservedByOtherHolidays}</Text></Text>
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
                    <Text>Loading pack information...</Text>
                )}
            </Dialog.Content>
            <Dialog.Actions>
                <Button onPress={onDismiss}>Close</Button>
                <Button onPress={pack}>Pack and Continue</Button>
            </Dialog.Actions>
        </Dialog>
    )
}