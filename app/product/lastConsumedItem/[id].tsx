import AppWrapper from "@/components/AppWrapper";
import LastConsumedItemCard from "@/components/LastConsumedItemCard";
import { useGetStockHistoryByProduct } from "@/src/data/hooks/useGetStockHistoryByProduct";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";

export default function LastConsumedItemPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = id ?? "";
  const router = useRouter();
  const theme = useTheme();

  const historyQ = useGetStockHistoryByProduct(productId);
  const takeEvents = useMemo(
    () => historyQ.data?.filter((event) => event.type === "TAKE" && !!event.packId) ?? [],
    [historyQ.data]
  );

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [takeEvents.length]);

  const currentEvent = takeEvents[currentIndex];

  const handlePrev = () => setCurrentIndex((idx) => Math.min(takeEvents.length - 1, idx + 1)); // Go to older event
  const handleNext = () => setCurrentIndex((idx) => Math.max(0, idx - 1)); // Go to newer event

  if (!productId) {
    return (
      <AppWrapper>
        <Text>Product id not provided.</Text>
      </AppWrapper>
    );
  }

  if (historyQ.isPending) {
    return (
      <AppWrapper>
        <Text>Loading history...</Text>
      </AppWrapper>
    );
  }

  if (takeEvents.length === 0) {
    return (
      <AppWrapper>
        <View style={{ marginBottom: 16 }}>
          <Button
            mode="text"
            onPress={() => router.back()}
            icon="arrow-left"
            style={{ alignSelf: "flex-start" }}
          >
            Back
          </Button>
        </View>
        <Card>
          <Card.Content>
            <Text>No TAKE events found for this product.</Text>
          </Card.Content>
        </Card>
      </AppWrapper>
    );
  }

  return (
    <AppWrapper>
      <View style={{ marginBottom: 16 }}>
        <Button
          mode="text"
          onPress={() => router.back()}
          icon="arrow-left"
          style={{ alignSelf: "flex-start" }}
        >
          Back
        </Button>
      </View>

      <View style={{ gap: 12, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Button mode="outlined" disabled={currentIndex === takeEvents.length - 1} onPress={handlePrev} style={{minWidth: 100}}>
            Previous
          </Button>
          <Text variant="titleMedium">{takeEvents.length - currentIndex} / {takeEvents.length}</Text>
          <Button
            mode="outlined"
            disabled={currentIndex === 0}
            onPress={handleNext}
            style={{minWidth: 100}}
          >
            Next
          </Button>
        </View>

        <LastConsumedItemCard productId={productId} packId={currentEvent.packId!} />
      </View>
    </AppWrapper>
  );
}