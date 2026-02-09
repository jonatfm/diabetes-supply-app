import AppWrapper from "@/components/AppWrapper";
import NumberInput from "@/components/NumberInput";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Card, Text, TextInput, useTheme } from "react-native-paper";

export default function PlanHoliday() {
    const [location, setLocation] = useState<string>("");
    const [daysAway, setDaysAway] = useState<number|null>(0);
    const productsQ = useProducts();
    const theme = useTheme();

    return (
        <AppWrapper>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            >
                <Text variant="headlineLarge" style={{marginBottom: 24}}>
                    Plan holiday
                </Text>
                <Text variant="titleLarge" style={{marginBottom: 12}}>
                    Enter holiday details
                </Text>

                <Card elevation={1} style={{marginBottom: 24}}>
                    <Card.Content style={{gap: 12}}>
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
                                How long will you be away?
                            </Text>
                            <NumberInput
                                label="Number of days"
                                value={daysAway}
                                onChangeText={setDaysAway}
                            />
                        </View>
                    </Card.Content>
                </Card>

                <Card elevation={1} style={{marginBottom: 24}}>
                    <Card.Content style={{gap: 12}}>
                        <View>
                            <Text variant="titleMedium">
                                Select how your items will be handled
                            </Text>
                        </View>
                        {productsQ.data && productsQ.data.map((product) => {
                            if (product.requiredForHoliday) {
                                return (
                                    <View key={product.id} style={{backgroundColor: theme.colors.primaryContainer, padding: 12, borderRadius: 8}}>
                                        <Text variant="labelLarge" style={{color: theme.colors.onPrimaryContainer}}>{product.name}</Text>
                                        
                                    </View>
                                )
                            }
                        })}
                    </Card.Content>
                </Card>
            </ScrollView>
        </AppWrapper>
    );
}