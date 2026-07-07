import AppWrapper from "@/components/AppWrapper";
import { db, useDatabase } from "@/db";
import { Holiday } from "@/db/schema";
import { holidayRepo } from "@/src/data/holidayRepo";
import { useActivateHoliday } from "@/src/data/hooks/useActivateHoliday";
import { useActiveHoliday } from "@/src/data/hooks/useActiveHoliday";
import { useDeleteHoliday } from "@/src/data/hooks/useDeleteHoliday";
import { useEndHoliday } from "@/src/data/hooks/useEndHoliday";
import { useHolidays } from "@/src/data/hooks/useHolidays";
import { useMarkHolidayReconciled } from "@/src/data/hooks/useMarkHolidayReconciled";
import { packsRepo } from "@/src/data/packsRepo";
import { qk } from "@/src/data/queryKeys";
import { buildTripExpiryWarnings, TripExpiryWarning } from "@/src/domain/holidayPlanningService";
import { calculateHolidayNeeds, calculateHolidayNeedsSimple, HolidayNeedsSimpleResult } from "@/src/utils/calculateHolidayNeeds";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, Card, Dialog, FAB, Icon, Portal, Text, useTheme } from "react-native-paper";

function HolidayCard({ holiday, onRepack, onDelete }: { holiday: Holiday; onRepack: (holidayId: string) => void; onDelete: (holiday: Holiday) => void }) {
    const theme = useTheme();
    const router = useRouter();
    const active = holiday.state === "ACTIVE";
    const [holidayNeeds, setHolidayNeeds] = useState<HolidayNeedsSimpleResult[]>([]);
    const [totalUnitsByProduct, setTotalUnitsByProduct] = useState<Record<string, number | undefined>>({});
    const [expiryWarnings, setExpiryWarnings] = useState<TripExpiryWarning[]>([]);
    const activateHolidayM = useActivateHoliday();
    const activeHolidayQ = useActiveHoliday();
    const endHolidayM = useEndHoliday();
    const markReconciledM = useMarkHolidayReconciled();

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
        if (activeHolidayQ.data && activeHolidayQ.data.id !== holiday.id) return;
        activateHolidayM.mutate(holiday.id);
    }
 
    const borderColor = active ? theme.colors.primary : theme.colors.surfaceVariant;
    const borderWidth = active ? 3 : 0;
    const accentColor = active ? theme.colors.onPrimaryContainer : theme.colors.primary;
    const tripDateText = holiday.startDate && holiday.endDate
        ? `${holiday.startDate} to ${holiday.endDate}`
        : `${holiday.durationDays} days`;

    return (
        <Card elevation={3} style={{marginBottom: 16, borderColor: borderColor, borderWidth: borderWidth}}>
            <Card.Content>
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

                <View>
                    {holiday.state === "PLANNED" && (
                        <View style={{flex: 1, gap: 6, flexDirection: "row", marginTop: 16}}>
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
                        <View style={{flex: 1, gap: 6, flexDirection: "row", marginTop: 16}}>
                            <Button icon="delete" mode="outlined" textColor={theme.colors.error} onPress={() => onDelete(holiday)}>
                                Delete
                            </Button>
                            <Button icon="refresh" mode="outlined" onPress={() => onRepack(holiday.id)}>
                                Repack
                            </Button>
                            <Button icon="airplane-takeoff" mode="contained" style={{flex: 1}} onPress={activateHoliday} disabled={activeHolidayQ.data && activeHolidayQ.data.id !== holiday.id}>
                                Go!
                            </Button>
                        </View>
                    )}
                    {holiday.state === "ACTIVE" && (
                        <View style={{ gap: 8, marginTop: 16 }}>
                            <Button
                                icon="airplane-landing"
                                mode="contained"
                                buttonColor={theme.colors.error}
                                onPress={() => endHolidayM.mutate(holiday.id)}
                            >
                                End Holiday
                            </Button>
                            <Button icon="delete" mode="outlined" textColor={theme.colors.error} onPress={() => onDelete(holiday)}>
                                Delete Holiday
                            </Button>
                        </View>
                    )}
                    {holiday.state === "COMPLETE" && (
                        <View style={{ marginTop: 16, gap: 8 }}>
                            {holiday.returnHomeCompletedAt ? (
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Return-home reconciliation complete.
                                </Text>
                            ) : (
                                <Button
                                    icon="home-check"
                                    mode="contained-tonal"
                                    onPress={() => markReconciledM.mutate(holiday.id)}
                                    loading={markReconciledM.isPending}
                                >
                                    Mark return-home check done
                                </Button>
                            )}
                            <Button icon="delete" mode="outlined" textColor={theme.colors.error} onPress={() => onDelete(holiday)}>
                                Delete
                            </Button>
                        </View>
                    )}
                </View>
            </Card.Content>
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
    const holidaysQ = useHolidays();
    const deleteHolidayM = useDeleteHoliday();

    const handleRepack = async () => {
        if (!hookDb || !repackHolidayId) return;
        await holidayRepo(hookDb).deletePacksForHoliday(repackHolidayId);
        await holidayRepo(hookDb).updateHolidayState(repackHolidayId, "PLANNED");
        await qc.invalidateQueries({ queryKey: qk.packsForHoliday(repackHolidayId) });
        await holidaysQ.refetch();
        setRepackHolidayId(null);
    };

    const handleDeleteHoliday = async () => {
        if (!deleteHoliday) return;
        await deleteHolidayM.mutateAsync(deleteHoliday.id);
        setDeleteHoliday(null);
    };
    
    return (
        <AppWrapper bottomEdge={false}>
            <View style={{flex: 1}}>
                <Text variant="headlineLarge" style={{ marginBottom: 24 }}>
                    Your Holidays
                </Text>

                {holidaysQ.data && holidaysQ.data.length > 0 ? (
                    <View style={{ flex: 1 }}>
                            <FlatList
                                data={holidaysQ.data
                                    .slice()
                                    .sort((a, b) => {
                                        // Active holidays first
                                        if (a.state === "ACTIVE" && b.state !== "ACTIVE") return -1;
                                        if (a.state !== "ACTIVE" && b.state === "ACTIVE") return 1;
                                        // Then by updatedAt descending
                                        return b.updatedAt - a.updatedAt;
                                    })}
                                renderItem={({ item }) => <HolidayCard key={item.id} holiday={item} onRepack={setRepackHolidayId} onDelete={setDeleteHoliday} />}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={{ paddingBottom: 100 }}
                                showsVerticalScrollIndicator={false}
                                removeClippedSubviews={true}
                                maxToRenderPerBatch={10}
                                updateCellsBatchingPeriod={50}
                                initialNumToRender={10}
                                windowSize={10}
                            />
                    </View>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
                        <Icon source="ghost" size={64} color={theme.colors.primary} />
                        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>No holidays here yet</Text>
                        <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Add a holiday to get started</Text>
                    </View>
                )}
            </View>

            <FAB
                icon="plus"
                label="Plan Holiday"
                onPress={() => router.push("/holiday_mode/plan_holiday")}
                style={{
                    position: "absolute",
                    bottom: 32,
                    right: 16,
                }}
            />

            <Portal>
                <Dialog visible={repackHolidayId !== null} onDismiss={() => setRepackHolidayId(null)}>
                    <Dialog.Title>Repack holiday?</Dialog.Title>
                    <Dialog.Content>
                        <Text>This will remove all currently packed items for this holiday and reset it to the planning state.</Text>
                        <Text style={{ marginTop: 8, fontWeight: 'bold' }}>You will need to pack everything again from scratch.</Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setRepackHolidayId(null)}>Cancel</Button>
                        <Button textColor={theme.colors.error} onPress={handleRepack}>Repack</Button>
                    </Dialog.Actions>
                </Dialog>
                <Dialog visible={deleteHoliday !== null} onDismiss={() => setDeleteHoliday(null)}>
                    <Dialog.Title>Delete holiday?</Dialog.Title>
                    <Dialog.Content>
                        <Text>
                            This will delete {deleteHoliday?.destination ?? "this holiday"} and remove its packed item reservations.
                        </Text>
                        {deleteHoliday?.state === "ACTIVE" ? (
                            <Text style={{ marginTop: 8, fontWeight: "bold", color: theme.colors.error }}>
                                This holiday is active. Deleting it will immediately stop active-holiday restrictions.
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
        </AppWrapper>
    );
}
