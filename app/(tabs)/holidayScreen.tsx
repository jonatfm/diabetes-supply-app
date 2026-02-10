import AppWrapper from "@/components/AppWrapper";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useHolidays } from "@/src/data/hooks/useHolidays";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { FAB, Icon, Text, useTheme } from "react-native-paper";
import { RangeChange } from "react-native-paper-dates/lib/typescript/Date/Calendar";

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
                {holidaysQ.data && holidaysQ.data.length > 0 ? (holidaysQ.data.map((holiday) => (
                    <Text key={holiday.id} variant="bodyMedium">
                        {holiday.destination} - {holiday.durationDays} days
                    </Text>
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
