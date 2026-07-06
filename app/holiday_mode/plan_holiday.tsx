import AppWrapper from "@/components/AppWrapper";
import NumberInput from "@/components/NumberInput";
import { useDatabase } from "@/db";
import { HOLIDAY_ITEM_METHODS, HOLIDAY_ITEM_METHODS_ATTRIBUTES, HOLIDAY_ITEM_METHODS_LABELS, Product } from "@/db/schema";
import { useCreateHoliday } from "@/src/data/hooks/useCreateHoliday";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Card, Chip, SegmentedButtons, Text, TextInput, useTheme } from "react-native-paper";

type ItemState = {
    selectedMethod: typeof HOLIDAY_ITEM_METHODS[number];
    selectedAttributeValues: Record<string, number|null>;
};

function ItemCard({
    product, 
    itemState, 
    onStateChange
}: {
    product: Product;
    itemState: ItemState;
    onStateChange: (state: ItemState) => void;
}) {
    const theme = useTheme();

    useEffect(() => {
        if (!itemState.selectedMethod) return;
        const newValues = {...itemState.selectedAttributeValues};
        let hasMissingDefaults = false;
        HOLIDAY_ITEM_METHODS_ATTRIBUTES[itemState.selectedMethod]?.forEach((attr) => {
            if (!(attr.attributeName in newValues)) {
                newValues[attr.attributeName] = attr.default || 0;
                hasMissingDefaults = true;
            }
        });
        if (!hasMissingDefaults) return;
        onStateChange({
            ...itemState,
            selectedAttributeValues: newValues
        });
    }, [itemState, onStateChange]);

    return (
        <View key={product.id} style={{backgroundColor: theme.colors.surface, padding: 12, borderRadius: 8}}>
            <Text variant="labelLarge" style={{color: theme.colors.onSurface}}>{product.name}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                <SegmentedButtons
                    value={HOLIDAY_ITEM_METHODS_LABELS[itemState.selectedMethod]}
                    onValueChange={(value) => {
                        const method = HOLIDAY_ITEM_METHODS.find((m) => HOLIDAY_ITEM_METHODS_LABELS[m] === value);
                        if (method) {
                            onStateChange({
                                ...itemState,
                                selectedMethod: method
                            });
                        }
                    }}
                    density="medium"
                    buttons={HOLIDAY_ITEM_METHODS.map((method) => ({
                        value: HOLIDAY_ITEM_METHODS_LABELS[method],
                        label: HOLIDAY_ITEM_METHODS_LABELS[method],
                    }))}
                />
            </ScrollView>
            {HOLIDAY_ITEM_METHODS_ATTRIBUTES[itemState.selectedMethod] && (
                <View style={{marginTop: 12, gap: 6}}>
                    {HOLIDAY_ITEM_METHODS_ATTRIBUTES[itemState.selectedMethod]?.map((attr) => {
                        return (
                            <NumberInput
                                key={attr.attributeName}
                                label={attr.attributeLabel}
                                value={itemState.selectedAttributeValues[attr.attributeName] || null}
                                onChangeText={(value) => {
                                    onStateChange({
                                        ...itemState,
                                        selectedAttributeValues: {
                                            ...itemState.selectedAttributeValues,
                                            [attr.attributeName]: value,
                                        }
                                    });
                                }}
                            />
                        )
                    })}
                </View>
            )}
        </View>
    )
}

const filterAllowedAttributes = (attributes: Record<string, number|null>, method: typeof HOLIDAY_ITEM_METHODS[number]) => {
    const allowedAttrs = HOLIDAY_ITEM_METHODS_ATTRIBUTES[method]?.map(attr => attr.attributeName) || [];
    return Object.fromEntries(
        Object.entries(attributes).filter(([key]) => allowedAttrs.includes(key))
    );
}

export default function PlanHoliday() {
    const db = useDatabase();
    const router = useRouter();
    const [location, setLocation] = useState<string>("");
    const [daysAway, setDaysAway] = useState<number|null>(null);
    const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const productsQ = useProducts();
    const createHolidayQ = useCreateHoliday();

    // Check if all fields are filled
    const isFormValid = () => {
        // Check basic fields
        if (!location || location.trim() === "" || daysAway === null || daysAway <= 0 || selectedProducts.length === 0) {
            return false;
        }

        // Check all required products have complete item states
        for (const product of selectedProducts) {
            const itemState = itemStates[product.id];
            if (!itemState) return false;

            // Check if all attribute values are filled (not null)
            const attributes = HOLIDAY_ITEM_METHODS_ATTRIBUTES[itemState.selectedMethod] || [];
            for (const attr of attributes) {
                const value = itemState.selectedAttributeValues[attr.attributeName];
                if (value === null || value === undefined) {
                    return false;
                }
            }
        }

        return true;
    };

    const handleConfirmButtonPress = async () => {
        if (!isFormValid()) return;

        await createHolidayQ.mutateAsync({
            destination: location.trim(),
            durationDays: daysAway!,
            products: Object.fromEntries(
            Object.entries(itemStates)
                .filter(([productId, state]) => {
                // Only include if product is still selected
                if (!selectedProducts.some(p => p.id === productId)) return false;
                
                // Check if any attribute value is greater than 0
                const attributes = HOLIDAY_ITEM_METHODS_ATTRIBUTES[state.selectedMethod] || [];
                return attributes.some(attr => {
                    const value = state.selectedAttributeValues[attr.attributeName];
                    return value !== null && value !== undefined && value > 0;
                });
                })
                .map(([productId, state]) => [
                productId,
                {
                    amountCalculationType: state.selectedMethod,
                    amountCalculationAttributes: filterAllowedAttributes(state.selectedAttributeValues, state.selectedMethod),
                }
                ])
            )
        });

        router.navigate("/(tabs)/holidayScreen");
    }

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
                                error={location === ""}
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

                {db && (
                <>
                    <Text variant="titleMedium">Select products to take with you</Text>
                    {productsQ.data && (
                    <View style={{flexDirection: "row", flexWrap: "wrap", gap: 8}}>
                        {productsQ.data.map((product) => {
                        const selected = selectedProducts.some((p) => p.id === product.id)
                        return (
                            <Chip
                            key={product.id}
                            selected={selected}
                            mode={selected ? "flat" : "outlined"}
                            icon={selected ? "check" : "plus"}
                            onPress={() => {
                                if (selected) {
                                    setSelectedProducts((prev) => prev.filter((p) => p.id !== product.id));
                                } else {
                                    setSelectedProducts((prev) => [...prev, product]);
                                }
                            }}
                            >{product.name}</Chip>
                        )
                        })}
                    </View>
                    )}
                </>
                )}

                <Card elevation={1} style={{marginBottom: 12}}>
                    <Card.Content style={{gap: 12}}>
                        <View>
                            <Text variant="titleMedium">
                                Select how your items will be handled
                            </Text>
                        </View>
                        {productsQ.data && productsQ.data.map((product) => {
                            if (selectedProducts.some((p) => p.id === product.id)) {
                                return (
                                    <ItemCard 
                                        key={product.id} 
                                        product={product}
                                        itemState={itemStates[product.id] || {
                                            selectedMethod: HOLIDAY_ITEM_METHODS[0],
                                            selectedAttributeValues: {}
                                        }}
                                        onStateChange={(state) => {
                                            setItemStates(prev => ({
                                                ...prev,
                                                [product.id]: state
                                            }));
                                        }}
                                    />
                                )
                            }
                        })}
                    </Card.Content>
                </Card>

                <Button 
                    mode="contained" 
                    onPress={handleConfirmButtonPress}
                    disabled={!isFormValid()}
                >
                    Confirm
                </Button>
            </ScrollView>
        </AppWrapper>
    );
}
