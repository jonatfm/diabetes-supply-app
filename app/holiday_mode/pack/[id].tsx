import AppWrapper from "@/components/AppWrapper";
import { useGetPacksForHoliday } from "@/src/data/hooks/useGetPacksForHoliday";
import { useHoliday } from "@/src/data/hooks/useHoliday";
import { useProduct } from "@/src/data/hooks/useProduct";
import { calculateHolidayNeedsSimple, HolidayNeedsSimpleResult } from "@/src/utils/calculateHolidayNeeds";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ImageBackground, Pressable, useWindowDimensions, View } from "react-native";
import { Button, Card, Dialog, Portal, Text, useTheme } from "react-native-paper";

export default function PackForHoliday() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const {width} = useWindowDimensions();
    const theme = useTheme();
    const router = useRouter();
    const holiday = useHoliday(id);
    const packsForHoliday = useGetPacksForHoliday(id);
    const [holidayNeedsSimple, setHolidayNeedsSimple] = useState<HolidayNeedsSimpleResult[]>([]);
    const [isPackItemDialogVisible, setIsPackItemDialogVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

    // Calculate responsive grid layout
    // Account for AppWrapper padding (typically 16px on each side) and Card.Content padding (16px on each side)
    const containerPadding = 64; // Total horizontal padding from all containers
    const availableWidth = width - containerPadding;
    
    // Responsive breakpoints optimized for phones
    const columns = availableWidth < 300 ? 2 : availableWidth < 500 ? 2 : availableWidth < 800 ? 3 : 4;
    const gap = availableWidth < 300 ? 8 : 12;
    const itemWidth = (availableWidth - (columns - 1) * gap) / columns;

    useEffect(() => {
        if (!holiday.data) return;
        calculateHolidayNeedsSimple(holiday.data).then(setHolidayNeedsSimple);
    }, [holiday.data]);

    // Count packed items per product
    const packedCounts = packsForHoliday.data?.reduce((acc, pack) => {
        if (pack.productId) {
            acc[pack.productId] = (acc[pack.productId] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>) || {};

    const handleItemPress = (item: HolidayNeedsSimpleResult) => {
        setSelectedProduct(item.product.id);
        setIsPackItemDialogVisible(true);
    }

    const accentColor = holiday.data?.state === "ACTIVE" ? theme.colors.onPrimaryContainer : theme.colors.primary;

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
            <View>
                <Text variant="headlineLarge" style={{marginBottom: 24}}>
                    Pack for <Text style={{color: theme.colors.primary}}>{holiday.data?.destination}</Text>
                </Text>
                
                <Card style={{marginBottom: 16}}>
                    <Card.Content>
                        <Text variant="titleMedium" style={{marginBottom: 8}}>Packing list</Text>
                        <Text variant="bodyMedium" style={{marginBottom: 16}}>Press an item to see what exactly is needed</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: "flex-start", gap: gap}}>
                            {holidayNeedsSimple.map((item, index) => (
                                <Pressable onPress={() => handleItemPress(item)} 
                                    key={item.product.id} 
                                    style={[{
                                        width: itemWidth, 
                                        aspectRatio: 1/1, 
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                    }, (packedCounts[item.product.id] || 0) < item.calculatedAmount ? { borderWidth: 2, borderColor: theme.colors.error } : {}]}
                                >
                                    <ImageBackground 
                                        source={item.product.imageUri ? { uri: item.product.imageUri } : undefined}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            justifyContent: 'space-between',
                                        }}
                                        imageStyle={{ borderRadius: 12 }}
                                    >
                                        <View 
                                            style={{
                                                flex: 1,
                                                backgroundColor: item.product.imageUri 
                                                    ? (packedCounts[item.product.id] || 0) < item.calculatedAmount ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.2)'
                                                    : theme.colors.surfaceVariant,
                                                padding: 12,
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <Text 
                                                variant="labelMedium" 
                                                style={{
                                                    color: item.product.imageUri 
                                                        ? '#ffffff' 
                                                        : accentColor,
                                                    textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                                    textShadowOffset: { width: 0, height: 1 },
                                                    textShadowRadius: 3,
                                                }}
                                                numberOfLines={2}
                                            >
                                                {item.product.name}
                                            </Text>
                                            <Text 
                                                variant="bodyLarge" 
                                                style={{
                                                    color: item.product.imageUri 
                                                        ? '#ffffff' 
                                                        : theme.colors.onSurface,
                                                    fontWeight: 'bold',
                                                    fontSize: 18,
                                                    textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                                    textShadowOffset: { width: 0, height: 1 },
                                                    textShadowRadius: 3,
                                                }}
                                            >
                                                {packedCounts[item.product.id] || 0} / {item.calculatedAmount}
                                            </Text>
                                        </View>
                                    </ImageBackground>
                                </Pressable>
                            ))}
                        </View>
                    </Card.Content>
                </Card>
            </View>

            <Portal>
                <PackItemsDialog visible={isPackItemDialogVisible && selectedProduct !== null} onDismiss={() => setIsPackItemDialogVisible(false)} productId={selectedProduct!} />
            </Portal>
        </AppWrapper>
    )
}

function PackItemsDialog({ visible, onDismiss, productId }: { visible: boolean; onDismiss: () => void; productId: string }) {
    const product = useProduct(productId); 
    return (
        <Dialog visible={visible} onDismiss={onDismiss}>
            <Dialog.Title>{product.data?.name}</Dialog.Title>
        </Dialog>
    )
}