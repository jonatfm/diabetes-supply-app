import AppWrapper from "@/components/AppWrapper";
import { db, useDatabase } from "@/db";
import { Holiday } from "@/db/schema";
import { holidayRepo } from "@/src/data/holidayRepo";
import { useActivateHoliday } from "@/src/data/hooks/useActivateHoliday";
import { useActiveHoliday } from "@/src/data/hooks/useActiveHoliday";
import { useEndHoliday } from "@/src/data/hooks/useEndHoliday";
import { useHolidays } from "@/src/data/hooks/useHolidays";
import { useMarkHolidayReconciled } from "@/src/data/hooks/useMarkHolidayReconciled";
import { packsRepo } from "@/src/data/packsRepo";
import { qk } from "@/src/data/queryKeys";
import { calculateHolidayNeedsSimple, HolidayNeedsSimpleResult } from "@/src/utils/calculateHolidayNeeds";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, Card, Dialog, FAB, Icon, Portal, Text, useTheme } from "react-native-paper";

function HolidayCard({ holiday, onRepack }: { holiday: Holiday; onRepack: (holidayId: string) => void }) {
    const theme = useTheme();
    const router = useRouter();
    const active = holiday.state === "ACTIVE";
    const [holidayNeeds, setHolidayNeeds] = useState<HolidayNeedsSimpleResult[]>([]);
    const [totalUnitsByProduct, setTotalUnitsByProduct] = useState<Record<string, number | undefined>>({});
    const activateHolidayM = useActivateHoliday();
    const activeHolidayQ = useActiveHoliday();
    const endHolidayM = useEndHoliday();
    const markReconciledM = useMarkHolidayReconciled();

    useEffect(() => {
        calculateHolidayNeedsSimple(holiday).then(setHolidayNeeds);
    }, [holiday]);

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

                <View>
                    {holiday.state === "PLANNED" && (
                        <View style={{flex: 1, gap: 6, flexDirection: "row", marginTop: 16}}>
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
                            <Button icon="refresh" mode="outlined" onPress={() => onRepack(holiday.id)}>
                                Repack
                            </Button>
                            <Button icon="airplane-takeoff" mode="contained" style={{flex: 1}} onPress={activateHoliday} disabled={activeHolidayQ.data && activeHolidayQ.data.id !== holiday.id}>
                                Go!
                            </Button>
                        </View>
                    )}
                    {holiday.state === "ACTIVE" && (
                        <Button
                            icon="airplane-landing"
                            mode="contained"
                            buttonColor={theme.colors.error}
                            style={{marginTop: 16}}
                            onPress={() => endHolidayM.mutate(holiday.id)}
                        >
                            End Holiday
                        </Button>
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
    const holidaysQ = useHolidays();

    const handleRepack = async () => {
        if (!hookDb || !repackHolidayId) return;
        await holidayRepo(hookDb).deletePacksForHoliday(repackHolidayId);
        await holidayRepo(hookDb).updateHolidayState(repackHolidayId, "PLANNED");
        await qc.invalidateQueries({ queryKey: qk.packsForHoliday(repackHolidayId) });
        await holidaysQ.refetch();
        setRepackHolidayId(null);
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
                                renderItem={({ item }) => <HolidayCard key={item.id} holiday={item} onRepack={setRepackHolidayId} />}
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
            </Portal>
        </AppWrapper>
    );
}
