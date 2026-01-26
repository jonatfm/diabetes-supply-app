import AppWrapper from "@/components/AppWrapper";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Card, Portal, Text, TextInput } from "react-native-paper";
import { DatePickerModal } from "react-native-paper-dates";
import { RangeChange } from "react-native-paper-dates/lib/typescript/Date/Calendar";

export default function HolidayScreen() {
    const [location, setLocation] = useState<string>("");
    // const [numberOfDays, setNumberOfDays] = useState<number | null>(null);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    

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
                    Plan a Holiday
                </Text>

                <Text variant="titleLarge" style={{ marginBottom: 12 }}>
                    Plan new holiday
                </Text>
                <Card elevation={1} style={{ marginBottom: 24 }}>
                    <Card.Content style={{ gap: 12 }}>
                        <View>
                            <Text variant="titleMedium">
                                Where are you going?
                            </Text>
                            <TextInput
                                label="Location"
                                value={location}
                                onChangeText={(text) => setLocation(text)}
                            />
                        </View>
                        <View>
                            <Text variant="titleMedium">
                                When will you be away?
                            </Text>
                            <Button
                                mode={(startDate && endDate) ? "outlined" : "contained"}
                                onPress={() => setIsDatePickerOpen(true)}
                            >
                                Select Dates
                            </Button>
                            {(startDate && endDate) && (
                                <Text>
                                    From {startDate.toDateString()} to {endDate.toDateString()}
                                </Text>
                            )}
                        </View>
                    </Card.Content>
                </Card>
            </ScrollView>

            <Portal>
                <DatePickerModal
                    locale="en"
                    mode="range"
                    visible={isDatePickerOpen}
                    onDismiss={() => setIsDatePickerOpen(false)}
                    startDate={startDate}
                    endDate={endDate}
                    onConfirm={onConfirm}
                />
            </Portal>
        </AppWrapper>
    );
}
