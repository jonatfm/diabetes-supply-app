import AppWrapper from "@/components/AppWrapper";
import NumberInput from "@/components/NumberInput";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Card, Text, TextInput } from "react-native-paper";

export default function HolidayScreen() {
    const [location, setLocation] = useState<string>("");
    const [numberOfDays, setNumberOfDays] = useState<number|null>(null);

    return (
        <AppWrapper>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 24}}
            >
                <Text variant="headlineLarge" style={{marginBottom: 24}}>Plan a Holiday</Text>

                <Text variant="titleLarge" style={{marginBottom: 12}}>Start new</Text>
                <Card elevation={1} style={{marginBottom: 24}}>
                    <Card.Content style={{gap: 12}}>
                        <View>
                            <Text variant="titleMedium">Where are you going?</Text>
                            <TextInput
                                label="Location"
                                value={location}
                                onChangeText={text => setLocation(text)}
                            />
                        </View>
                        <View>
                            <Text variant="titleMedium">How long are you staying?</Text>
                            <NumberInput
                                label="Number of days"
                                value={numberOfDays}
                                onChangeText={text => setNumberOfDays(text)}
                                minValue={1}
                            />
                        </View>
                    </Card.Content>
                </Card>
            </ScrollView>
        </AppWrapper>
    )
}