import AppWrapper from "@/components/AppWrapper";
import { db } from "@/db";
import { Holiday } from "@/db/schema";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useHolidays } from "@/src/data/hooks/useHolidays";
import { packsRepo } from "@/src/data/packsRepo";
import { calculateHolidayNeedsSimple, HolidayNeedsResult } from "@/src/utils/calculateHolidayNeeds";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Card, FAB, Icon, Text, useTheme } from "react-native-paper";
import { RangeChange } from "react-native-paper-dates/lib/typescript/Date/Calendar";

function HolidayCard(holiday: Holiday) {
    const theme = useTheme();
    const active = holiday.state === "ACTIVE";
    const [holidayNeeds, setHolidayNeeds] = useState<HolidayNeedsResult[]>([]);
    const [totalUnitsByProduct, setTotalUnitsByProduct] = useState<Record<string, number | undefined>>({});

    useEffect(() => {
        calculateHolidayNeedsSimple(holiday).then(setHolidayNeeds);
    }, []);

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

    const borderColor = active ? theme.colors.primary : theme.colors.surfaceVariant;
    const borderWidth = active ? 3 : 0;
    const accentColor = active ? theme.colors.onPrimaryContainer : theme.colors.primary;

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
                    <Text variant="titleMedium" style={{ color: accentColor }}>{holiday.durationDays} days</Text>
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
                        <Button icon="briefcase" mode="contained" style={{marginTop: 16}}>
                            Start packing
                        </Button>
                    )}
                    {holiday.state === "PACKED" && (
                        <View style={{flex: 1, gap: 6, flexDirection: "row", marginTop: 16}}>
                            <Button icon="refresh" mode="outlined">
                                Repack
                            </Button>
                            <Button icon="airplane-takeoff" mode="contained" style={{flex: 1}}>
                                Go!
                            </Button>
                        </View>
                    )}
                    {holiday.state === "ACTIVE" && (
                        <Button icon="airplane-landing" mode="contained" buttonColor={theme.colors.error} style={{marginTop: 16}}>
                            End Holiday
                        </Button>
                    )}
                </View>
            </Card.Content>
        </Card>
    )
}


export default function HolidayScreen() {
    const router = useRouter();
    const theme = useTheme();
    const [location, setLocation] = useState<string>("");
    // const [numberOfDays, setNumberOfDays] = useState<number | null>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const productsQ = useProducts();
    const holidaysQ = useHolidays();
    

    const onConfirm = useCallback<RangeChange>(({startDate, endDate}) => {
        setIsDatePickerOpen(false);
        setStartDate(startDate);
        setEndDate(endDate);
        console.log("[on-change-multi]", {startDate, endDate});
    }, []);

    return (
        <AppWrapper>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            >
                <Text variant="headlineLarge" style={{ marginBottom: 24 }}>
                    Your Holidays
                </Text>
                {holidaysQ.data && holidaysQ.data.length > 0 ? (holidaysQ.data.sort((a, b) => b.updatedAt - a.updatedAt).map((holiday) => (
                    <HolidayCard key={holiday.id} {...holiday} />
                ))) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
                        <Icon source="ghost" size={64} color={theme.colors.primary} />
                        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>No holidays here yet</Text>
                        <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>Add a holiday to get started</Text>
                    </View>
                )}
            </ScrollView>

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
        </AppWrapper>
    );
}
