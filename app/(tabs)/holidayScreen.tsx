import AppWrapper from "@/components/AppWrapper";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { FAB, Text } from "react-native-paper";
import { RangeChange } from "react-native-paper-dates/lib/typescript/Date/Calendar";

export default function HolidayScreen() {
    const router = useRouter();
    const [location, setLocation] = useState<string>("");
    // const [numberOfDays, setNumberOfDays] = useState<number | null>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const productsQ = useProducts();
    

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
            </ScrollView>

            <FAB
                icon="plus"
                label="Add Holiday"
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
