import AppWrapper from "@/components/AppWrapper";
import { GS1_AI_SPECS } from "@/scripts/gs1";
import { useFetchPack } from "@/src/data/hooks/useFetchPack";
import { useGetStockHistoryByProduct } from "@/src/data/hooks/useGetStockHistoryByProduct";
import Clipboard from "@react-native-clipboard/clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Icon, Text, useTheme } from "react-native-paper";

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
  const packQ = useFetchPack(currentEvent?.packId ?? "");
  const consumedAt = currentEvent ? new Date(currentEvent.occurredAt) : null;

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

        <Card>
          <Card.Content style={{ gap: 12 }}>
            {consumedAt && (
              <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
                Consumed {consumedAt.toLocaleString()} {currentIndex === 0 ? <Text style={{color: "green", fontWeight: "bold"}}>(Current)</Text> : null}
              </Text>
            )}

            {packQ.isPending && (
              <Text variant="bodyMedium">Loading pack details...</Text>
            )}

            {!packQ.isPending && !packQ.data && (
              <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                Pack details unavailable.
              </Text>
            )}

            {packQ.data?.ais && Object.entries(packQ.data.ais).map(([ai, value]) => {
              const spec = GS1_AI_SPECS[ai];
              const name = spec?.name || `AI ${ai}`;
              return (
                <View key={ai} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant, paddingBottom: 8 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.secondary, marginBottom: 4 }}>
                    {name} ({ai})
                  </Text>
                  <Pressable onPress={() => Clipboard.setString(value)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: "500" }}>
                      {value}
                    </Text>
                    <Icon source="content-copy" size={12} color={theme.colors.primary} />
                  </Pressable>
                </View>
              );
            })}
          </Card.Content>
        </Card>
      </View>
    </AppWrapper>
  );
}