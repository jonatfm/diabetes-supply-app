import AppWrapper from "@/components/AppWrapper";
import { db, useDatabase } from "@/db";
import { Holiday } from "@/db/schema";
import { holidayRepo } from "@/src/data/holidayRepo";
import { useActivateHoliday } from "@/src/data/hooks/useActivateHoliday";
import { useActiveHoliday } from "@/src/data/hooks/useActiveHoliday";
import { useDeleteHoliday } from "@/src/data/hooks/useDeleteHoliday";
import { useEndHoliday } from "@/src/data/hooks/useEndHoliday";
import { useHolidays } from "@/src/data/hooks/useHolidays";
import { packsRepo } from "@/src/data/packsRepo";
import { qk } from "@/src/data/queryKeys";
import { buildTripExpiryWarnings, TripExpiryWarning } from "@/src/domain/holidayPlanningService";
import { calculateHolidayNeeds, calculateHolidayNeedsSimple, HolidayNeedsSimpleResult } from "@/src/utils/calculateHolidayNeeds";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SectionList, View } from "react-native";
import { Button, Card, Dialog, FAB, Icon, Portal, Snackbar, Text, useTheme } from "react-native-paper";

function HolidayCard({ holiday, onRepack, onDelete, onError }: { holiday: Holiday; onRepack: (holidayId: string) => void; onDelete: (holiday: Holiday) => void; onError: (message: string) => void }) {
    const theme = useTheme();
    const router = useRouter();
    const active = holiday.state === "ACTIVE";
    const [holidayNeeds, setHolidayNeeds] = useState<HolidayNeedsSimpleResult[]>([]);
    const [totalUnitsByProduct, setTotalUnitsByProduct] = useState<Record<string, number | undefined>>({});
    const [expiryWarnings, setExpiryWarnings] = useState<TripExpiryWarning[]>([]);
    const [isEndTripDialogVisible, setIsEndTripDialogVisible] = useState(false);
    const activateHolidayM = useActivateHoliday();
    const activeHolidayQ = useActiveHoliday();
    const endHolidayM = useEndHoliday();

    useEffect(() => {
        calculateHolidayNeedsSimple(holiday).then(setHolidayNeeds);
    }, [holiday]);

    useEffect(() => {
        async function fetchWarnings() {
            if (!holiday.startDate || !holiday.endDate) {
                setExpiryWarnings([]);
                return;
            }

            if (holiday.state === "PLANNED") {
                const needs = await calculateHolidayNeeds(holiday);
                const candidates = [];
                for (const need of needs) {
                    for (const packEntry of need.packs) {
                        const pack = await packsRepo(db).fetchPackById(packEntry.packId);
                        if (pack) {
                            candidates.push({ pack, productName: need.product.name });
                        }
                    }
                }
                setExpiryWarnings(buildTripExpiryWarnings(holiday, candidates));
                return;
            }

            const packed = await holidayRepo(db).getPacksForHoliday(holiday.id);
            const candidates = [];
            for (const allocation of packed) {
                const pack = await packsRepo(db).fetchPackById(allocation.packId);
                const need = holidayNeeds.find((item) => item.product.id === allocation.productId);
                if (pack) {
                    candidates.push({ pack, productName: need?.product.name ?? "Packed item" });
                }
            }
            setExpiryWarnings(buildTripExpiryWarnings(holiday, candidates));
        }

        fetchWarnings();
    }, [holiday, holidayNeeds]);

    useEffect(() => {
        async function fetchTotalUnits() {
            const results: Record<string, number | undefined> = {};
            for (const need of holidayNeeds) {
                results[need.product.id] = await packsRepo(db).totalUnitsByProduct(need.product.id);
            }
            setTotalUnitsByProduct(results);
        }
        if (holidayNeeds.length > 0) {
            fetchTotalUnits();
        }
    }, [holidayNeeds]);

    const activateHoliday = async () => {
        if (active) return;
        if (activeHolidayQ.data && activeHolidayQ.data.id !== holiday.id) {
            onError(`End the ongoing trip to ${activeHolidayQ.data.destination} before starting another trip.`);
            return;
        }
        try {
            await activateHolidayM.mutateAsync(holiday.id);
        } catch (error) {
            onError(error instanceof Error ? error.message : "The trip could not be started.");
        }
    }
 
    const borderColor = active ? theme.colors.primary : theme.colors.surfaceVariant;
    const borderWidth = active ? 3 : 0;
    const accentColor = active ? theme.colors.onPrimaryContainer : theme.colors.primary;
    const tripDateText = holiday.startDate && holiday.endDate
        ? `${holiday.startDate} to ${holiday.endDate}`
        : `${holiday.durationDays} days`;

    return (
        <Card elevation={3} style={{marginBottom: 16, borderColor: borderColor, borderWidth: borderWidth}}>
            <Card.Content style={{ paddingBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
                    <Icon source="map-marker" size={28} color={accentColor} />
                    <Text variant="headlineMedium" style={{ color: accentColor, fontWeight: "bold" }}>{holiday.destination}</Text>
                    {active && (
                        <View style={{ marginLeft: "auto", backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text variant="labelLarge" style={{ color: theme.colors.onPrimary, fontWeight: "bold" }}>Active</Text>
                        </View>
                    )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Icon source="calendar" size={22} color={accentColor} />
                    <Text variant="titleMedium" style={{ color: accentColor }}>{tripDateText}</Text>
                </View>
                {holidayNeeds.map((need) => {
                    const totalUnits = totalUnitsByProduct[need.product.id];
                    return (
                        <View key={need.product.id} style={{marginTop: 6}}>
                            <Text variant="labelMedium" style={{color: accentColor}}>{need.product.name}</Text>
                            <Text variant="bodyLarge"
                                style={{color: totalUnits !== undefined && totalUnits < need.calculatedAmount ? theme.colors.error : theme.colors.onSurface}}
                            >{need.calculatedAmount} units required {totalUnits !== undefined && totalUnits < need.calculatedAmount ? `(${need.calculatedAmount - totalUnits} units missing)` : ""}</Text>
                        </View>
                    );
                })}

                {expiryWarnings.length > 0 && (
                    <Card mode="contained" style={{ marginTop: 12, backgroundColor: theme.colors.errorContainer }}>
                        <Card.Content style={{ gap: 4 }}>
                            <Text variant="titleSmall" style={{ color: theme.colors.onErrorContainer }}>
                                Expiry warnings for this trip
                            </Text>
                            {expiryWarnings.map((warning) => (
                                <Text key={`${warning.packId}-${warning.kind}`} variant="bodyMedium" style={{ color: theme.colors.onErrorContainer }}>
                                    {warning.productName}: expires {warning.expiry} {warning.kind === "EXPIRES_BEFORE_TRIP" ? "before departure" : "during the trip"}
                                </Text>
                            ))}
                        </Card.Content>
                    </Card>
                )}

                {holiday.state !== "COMPLETE" && <View style={{ marginTop: 16 }}>
                    {holiday.state === "PLANNED" && (
                        <View style={{flex: 1, gap: 6, flexDirection: "row"}}>
                            <Button icon="delete" mode="outlined" textColor={theme.colors.error} onPress={() => onDelete(holiday)}>
                                Delete
                            </Button>
                            <Button icon="pencil" mode="outlined" onPress={() => router.push(`/holiday_mode/plan_holiday?holidayId=${holiday.id}`)}>
                                Edit
                            </Button>
                            <Button icon="briefcase" mode="contained" style={{flex: 1}} onPress={() => router.push(`/holiday_mode/pack/${holiday.id}`)}>
                                Start packing
                            </Button>
                        </View>
                    )}
                    {holiday.state === "PACKED" && (
                        <View style={{flex: 1, gap: 6, flexDirection: "row"}}>
                            <Button icon="delete" mode="outlined" textColor={theme.colors.error} onPress={() => onDelete(holiday)}>
                                Delete
                            </Button>
                            <Button icon="refresh" mode="outlined" onPress={() => onRepack(holiday.id)}>
                                Repack
                            </Button>
                            <Button icon="airplane-takeoff" mode="contained" style={{flex: 1}} onPress={activateHoliday} loading={activateHolidayM.isPending} disabled={activateHolidayM.isPending}>
                                Start trip
                            </Button>
                        </View>
                    )}
                    {holiday.state === "ACTIVE" && (
                        <View style={{ gap: 8 }}>
                            <Button
                                icon="airplane-landing"
                                mode="contained"
                                buttonColor={theme.colors.error}
                                onPress={() => setIsEndTripDialogVisible(true)}
                            >
                                End Trip
                            </Button>
                        </View>
                    )}
                </View>}
            </Card.Content>
            <Portal>
                <Dialog visible={isEndTripDialogVisible} onDismiss={() => setIsEndTripDialogVisible(false)}>
                    <Dialog.Icon icon="flag-checkered" />
                    <Dialog.Title>End this trip?</Dialog.Title>
                    <Dialog.Content>
                        <Text>
                            This marks {holiday.destination} as completed and returns consumption to the normal inventory flow.
                        </Text>
                        <Text style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
                            The trip and its consumption history will be kept permanently.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setIsEndTripDialogVisible(false)}>Cancel</Button>
                        <Button
                            onPress={async () => {
                                try {
                                    await endHolidayM.mutateAsync(holiday.id);
                                    setIsEndTripDialogVisible(false);
                                } catch (error) {
                                    onError(error instanceof Error ? error.message : "The trip could not be ended.");
                                }
                            }}
                            loading={endHolidayM.isPending}
                            disabled={endHolidayM.isPending}
                        >
                            End trip
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
        </Card>
    )
}


export default function HolidayScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { db: hookDb } = useDatabase();
    const qc = useQueryClient();
    const [repackHolidayId, setRepackHolidayId] = useState<string | null>(null);
    const [deleteHoliday, setDeleteHoliday] = useState<Holiday | null>(null);
    const [screenError, setScreenError] = useState<string | null>(null);
    const holidaysQ = useHolidays();
    const deleteHolidayM = useDeleteHoliday();

    const handleRepack = async () => {
        if (!hookDb || !repackHolidayId) return;
        try {
            await holidayRepo(hookDb).repackHoliday(repackHolidayId);
            await qc.invalidateQueries({ queryKey: qk.packsForHoliday(repackHolidayId) });
            await qc.invalidateQueries({ queryKey: qk.upcomingHolidayAllocationsRoot() });
            await holidaysQ.refetch();
            setRepackHolidayId(null);
        } catch (error) {
            setScreenError(error instanceof Error ? error.message : "The trip could not be reset for repacking.");
        }
    };

    const handleDeleteHoliday = async () => {
        if (!deleteHoliday) return;
        try {
            await deleteHolidayM.mutateAsync(deleteHoliday.id);
            setDeleteHoliday(null);
        } catch (error) {
            setScreenError(error instanceof Error ? error.message : "The trip could not be deleted.");
        }
    };

    const ongoingTrips = holidaysQ.data
        ?.filter((holiday) => holiday.state === "ACTIVE")
        .sort((a, b) => b.updatedAt - a.updatedAt) ?? [];
    const plannedTrips = holidaysQ.data
        ?.filter((holiday) => holiday.state === "PLANNED" || holiday.state === "PACKED")
        .sort((a, b) => b.updatedAt - a.updatedAt) ?? [];
    const completedTrips = holidaysQ.data
        ?.filter((holiday) => holiday.state === "COMPLETE")
        .sort((a, b) => b.updatedAt - a.updatedAt) ?? [];
    
    return (
        <AppWrapper bottomEdge={false}>
            <View style={{flex: 1}}>
                <Text variant="headlineLarge" style={{ marginBottom: 24 }}>
                    Your Trips
                </Text>

                {holidaysQ.data && holidaysQ.data.length > 0 ? (
                    <View style={{ flex: 1 }}>
                            <SectionList
                                sections={[
                                    ...(ongoingTrips.length > 0 ? [{
                                        title: "Ongoing",
                                        data: ongoingTrips,
                                    }] : []),
                                    {
                                        title: "Planned",
                                        data: plannedTrips,
                                    },
                                    {
                                        title: "Completed",
                                        data: completedTrips,
                                    }
                                ]}
                                renderItem={({ item }) => <HolidayCard key={item.id} holiday={item} onRepack={setRepackHolidayId} onDelete={setDeleteHoliday} onError={setScreenError} />}
                                renderSectionHeader={({ section }) => (
                                    <View style={{ backgroundColor: theme.colors.background, paddingTop: 8, paddingBottom: 10 }}>
                                        <Text variant="titleLarge" style={{ fontWeight: "bold" }}>{section.title}</Text>
                                    </View>
                                )}
                                renderSectionFooter={({ section }) => section.data.length === 0 ? (
                                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                                        No {section.title.toLowerCase()} trips
                                    </Text>
                                ) : null}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 100 }}
                                showsVerticalScrollIndicator={false}
                                stickySectionHeadersEnabled={false}
                                removeClippedSubviews={true}
                                maxToRenderPerBatch={10}
                                updateCellsBatchingPeriod={50}
                                initialNumToRender={10}
                                windowSize={10}
                            />
                    </View>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
                        <Icon source="bag-suitcase" size={64} color={theme.colors.primary} />
                        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>No trips planned yet</Text>
                        <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Plan a trip to calculate what to pack and reserve concrete units from your inventory.</Text>
                    </View>
                )}
            </View>

            <FAB
                icon="plus"
                label="Plan Trip"
                onPress={() => router.push("/holiday_mode/plan_holiday")}
                style={{
                    position: "absolute",
                    bottom: 32,
                    right: 16,
                }}
            />

            <Portal>
                <Dialog visible={repackHolidayId !== null} onDismiss={() => setRepackHolidayId(null)}>
                    <Dialog.Title>Repack trip?</Dialog.Title>
                    <Dialog.Content>
                        <Text>This will remove all currently packed items for this trip and reset it to the planning state.</Text>
                        <Text style={{ marginTop: 8, fontWeight: 'bold' }}>You will need to pack everything again from scratch.</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setRepackHolidayId(null)}>Cancel</Button>
                        <Button textColor={theme.colors.error} onPress={handleRepack}>Repack</Button>
                    </Dialog.Actions>
                </Dialog>
                <Dialog visible={deleteHoliday !== null} onDismiss={() => setDeleteHoliday(null)}>
                    <Dialog.Title>Delete trip?</Dialog.Title>
                    <Dialog.Content>
                        <Text>
                            This will delete {deleteHoliday?.destination ?? "this trip"} and remove its packed item reservations.
                        </Text>
                        {deleteHoliday?.state === "ACTIVE" ? (
                            <Text style={{ marginTop: 8, fontWeight: "bold", color: theme.colors.error }}>
                                This trip is active. Deleting it will immediately stop active-trip restrictions.
                            </Text>
                        ) : null}
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDeleteHoliday(null)}>Cancel</Button>
                        <Button
                            textColor={theme.colors.error}
                            onPress={handleDeleteHoliday}
                            loading={deleteHolidayM.isPending}
                            disabled={deleteHolidayM.isPending}
                        >
                            Delete
                        </Button>
                    </Dialog.Actions>
                </Dialog>
            </Portal>
            <Snackbar visible={screenError !== null} onDismiss={() => setScreenError(null)} duration={5000}>
                {screenError}
            </Snackbar>
        </AppWrapper>
    );
}
