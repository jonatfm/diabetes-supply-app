import AppWrapper from "@/components/AppWrapper";
import NumberInput from "@/components/NumberInput";
import { useDatabase } from "@/db";
import { HOLIDAY_ITEM_METHODS, HOLIDAY_ITEM_METHODS_ATTRIBUTES, HOLIDAY_ITEM_METHODS_LABELS, Product } from "@/db/schema";
import { useCreateHoliday } from "@/src/data/hooks/useCreateHoliday";
import { useProducts } from "@/src/data/hooks/useGetProducts";
import { useHoliday } from "@/src/data/hooks/useHoliday";
import { usePackListForHoliday } from "@/src/data/hooks/usePackListForHoliday";
import { useUpdateHoliday } from "@/src/data/hooks/useUpdateHoliday";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Card, Chip, SegmentedButtons, Snackbar, Text, TextInput, useTheme } from "react-native-paper";
import { DatePickerInput } from "react-native-paper-dates";

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

function formatLocalDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function parseStoredDate(date: string | null | undefined) {
    if (!date) return undefined;
    const [year, month, day] = date.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
}

function daysInclusive(start: Date, end: Date) {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.max(1, Math.floor((endUtc - startUtc) / 86400000) + 1);
}

export default function PlanHoliday() {
    const db = useDatabase();
    const router = useRouter();
    const params = useLocalSearchParams<{ holidayId?: string }>();
    const holidayId = typeof params.holidayId === "string" ? params.holidayId : undefined;
    const isEditing = !!holidayId;
    const [location, setLocation] = useState<string>("");
    const [daysAway, setDaysAway] = useState<number|null>(null);
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [hasLoadedEditState, setHasLoadedEditState] = useState(false);
    const productsQ = useProducts();
    const createHolidayQ = useCreateHoliday();
    const updateHolidayQ = useUpdateHoliday();
    const holidayQ = useHoliday(holidayId ?? "");
    const packListQ = usePackListForHoliday(holidayId);

    const productsById = useMemo(() => {
        return new Map((productsQ.data ?? []).map((product) => [product.id, product]));
    }, [productsQ.data]);

    useEffect(() => {
        if (hasLoadedEditState || !isEditing || !holidayQ.data || !packListQ.data || !productsQ.data) return;

        if (holidayQ.data.state !== "PLANNED") {
            setFormError("Only planned trips can be edited. Repack this trip first if you need to change it.");
            return;
        }

        setLocation(holidayQ.data.destination);
        setDaysAway(holidayQ.data.durationDays);
        setStartDate(parseStoredDate(holidayQ.data.startDate));
        setEndDate(parseStoredDate(holidayQ.data.endDate));

        const selected = packListQ.data
            .map((entry) => productsById.get(entry.productId))
            .filter((product): product is Product => !!product);
        setSelectedProducts(selected);

        setItemStates(Object.fromEntries(
            packListQ.data.map((entry) => [
                entry.productId,
                {
                    selectedMethod: entry.amountCalculationType,
                    selectedAttributeValues: entry.amountCalculationAttributes as Record<string, number | null>,
                },
            ]),
        ));
        setHasLoadedEditState(true);
    }, [hasLoadedEditState, holidayQ.data, isEditing, packListQ.data, productsById, productsQ.data]);

    useEffect(() => {
        if (!startDate || !endDate) return;
        setDaysAway(daysInclusive(startDate, endDate));
    }, [startDate, endDate]);

    // Check if all fields are filled
    const isFormValid = () => {
        // Check basic fields
        if (!location || location.trim() === "" || daysAway === null || daysAway <= 0 || selectedProducts.length === 0) {
            return false;
        }

        if (startDate && endDate && endDate < startDate) {
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

    const buildProductsPayload = useCallback(() => Object.fromEntries(
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
    ), [itemStates, selectedProducts]);

    const handleConfirmButtonPress = async () => {
        if (!isFormValid()) return;

        try {
            const payload = {
                destination: location.trim(),
                durationDays: daysAway!,
                startDate: startDate ? formatLocalDate(startDate) : null,
                endDate: endDate ? formatLocalDate(endDate) : null,
                products: buildProductsPayload(),
            };

            if (isEditing && holidayId) {
                await updateHolidayQ.mutateAsync({
                    holidayId,
                    ...payload,
                });
            } else {
                await createHolidayQ.mutateAsync(payload);
            }

            router.navigate("/(tabs)/holidayScreen");
        } catch (error) {
            setFormError(error instanceof Error ? error.message : "Trip could not be saved.");
        }
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
                    {isEditing ? "Edit trip" : "Plan trip"}
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
                                When will you be away?
                            </Text>
                            <View style={{ gap: 8 }}>
                                <DatePickerInput
                                    locale="en"
                                    label="Start date"
                                    value={startDate}
                                    onChange={setStartDate}
                                    inputMode="start"
                                />
                                <DatePickerInput
                                    locale="en"
                                    label="Return date"
                                    value={endDate}
                                    onChange={setEndDate}
                                    inputMode="end"
                                    validRange={startDate ? { startDate } : undefined}
                                />
                            </View>
                        </View>
                        <View>
                            <Text variant="titleMedium">
                                Duration
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
                        {productsQ.data.filter((product) => product.active).map((product) => {
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
                    disabled={!isFormValid() || createHolidayQ.isPending || updateHolidayQ.isPending}
                    loading={createHolidayQ.isPending || updateHolidayQ.isPending}
                >
                    {isEditing ? "Save trip" : "Confirm"}
                </Button>
            </ScrollView>
            <Snackbar
                visible={formError !== null}
                onDismiss={() => setFormError(null)}
                duration={5000}
                action={{
                    label: "Dismiss",
                    onPress: () => setFormError(null),
                }}
            >
                {formError}
            </Snackbar>
        </AppWrapper>
    );
}
