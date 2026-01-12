import { GS1_AI_SPECS } from "@/scripts/gs1";
import { useColoredDotAssignments } from "@/src/data/hooks/useColoredDotAssignments";
import { useFetchPack } from "@/src/data/hooks/useFetchPack";
import { useGetSessionForPack } from "@/src/data/hooks/useGetSessionForPack";
import { useGetStockHistoryByProduct } from "@/src/data/hooks/useGetStockHistoryByProduct";
import { useProduct } from "@/src/data/hooks/useProduct";
import Clipboard from '@react-native-clipboard/clipboard';
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Card, Icon, Text, useTheme } from "react-native-paper";
import ColoredDot from "./ColoredDot";
import DaysProgressBar from "./DaysProgressBar";


export default function LastConsumedItemCard({ productId, packId }: { productId: string; packId: string }) {
  const theme = useTheme();
  const packQ = useFetchPack(packId);
  const productQ = useProduct(productId);
  const productHistoryQ = useGetStockHistoryByProduct(productId);
  const sessionForPackQ = useGetSessionForPack(packId);
  const coloredDotAssignments = useColoredDotAssignments(packId).data;
  const [lastConsumedAt, setLastConsumedAt] = useState<Date | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [daysCompleted, setDaysCompleted] = useState<number | null>(null);

  const sessionStatusColors: Record<string, string> = {
    "Completed": "green",
    "Failed": "red",
    "Removed early": "orange",
    "Lost": "red",
    "Unknown": "orange",
    "Ongoing": theme.colors.primary,
  };

  useEffect(() => {
    if (productHistoryQ.data && productHistoryQ.data.length > 0) {
      const takeEventForPack = productHistoryQ.data.find(
        event => event.type === "TAKE" && event.packId === packId
      );
      if (takeEventForPack) {
        setLastConsumedAt(new Date(takeEventForPack.occurredAt));
      } else {
        setLastConsumedAt(null);
      }
    }
  }, [productHistoryQ.data, packId]);

  useEffect(() => {
    if (!sessionForPackQ.data || !sessionForPackQ.data.startedAt) return;
    
    // Calculate the days between either startedAt and endedAt, or startedAt and now if no endedAt
    const startDate = new Date(sessionForPackQ.data.startedAt);
    const endDate = sessionForPackQ.data.endedAt ? new Date(sessionForPackQ.data.endedAt) : new Date();
    const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor(diffMs / MS_PER_DAY) + 1; // +1 to count the starting day
    setDaysCompleted(diffDays);
  }, [sessionForPackQ.data]);

  useEffect(() => {
    if (sessionForPackQ.data) {
      if (!sessionForPackQ.data.outcome) {
        setSessionStatus("Ongoing");
        return;
      }
      const outcome = sessionForPackQ.data.outcome;
      setSessionStatus((outcome.charAt(0).toUpperCase() + outcome.slice(1).toLowerCase()).replace('_', ' '));
    }
  }, [sessionForPackQ.data]);

  return (
    <>
      {packQ.data && (
        <Card elevation={2}>
          <Card.Content style={{ gap: 12 }}>
            {lastConsumedAt && !productQ.data?.isSessionBased && (
              <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
                Consumed {lastConsumedAt.toLocaleString()}
              </Text>
            )}
            {productQ.data && productQ.data.nominalSessionTimeDays && !!productQ.data.isSessionBased && (
              <>
                <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
                  Session started {sessionForPackQ.data?.startedAt ? new Date(sessionForPackQ.data.startedAt).toLocaleString() : "N/A"}
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>
                  Session status: <Text variant="bodyMedium" style={{color: sessionStatusColors[sessionStatus || "unknown"]}}>{sessionStatus || "N/A"}</Text>
                </Text>
                <DaysProgressBar
                  totalDays={productQ.data.nominalSessionTimeDays}
                  currentDay={Math.max(1, Math.min(daysCompleted ?? 1, productQ.data.nominalSessionTimeDays))}
                  colorForeground={sessionStatusColors[sessionStatus || "unknown"]}
                  colorBackground={theme.colors.onPrimary}
                />
              </>
            )}
            {productQ.data && !!productQ.data.useColoredDots && coloredDotAssignments && coloredDotAssignments.dotIds && coloredDotAssignments.dotIds.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text variant="bodyMedium" style={{ color: theme.colors.secondary }}>Assigned Dots:</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {coloredDotAssignments.dotIds.map((dotId, index) => (
                    <ColoredDot key={index} dotId={dotId} size={16} crossInactive={false} />
                  ))}
                </View>
              </View>
            )}
            {Object.entries(packQ.data.ais!).map(([ai, value]) => {
              const spec = GS1_AI_SPECS[ai];
              const name = spec?.name || `AI ${ai}`;
              return (
                <View key={ai} style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.surfaceVariant, paddingBottom: 8 }}>
                  <Text variant="labelSmall" style={{ color: theme.colors.secondary, marginBottom: 4 }}>
                    {name} ({ai})
                  </Text>
                  <Pressable onPress={() => {Clipboard.setString(value)}} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text variant="bodyMedium" style={{ fontWeight: '500' }}>
                      {value}
                    </Text>
                    <Icon source="content-copy" size={12} color={theme.colors.primary} />
                  </Pressable>
                </View>
              );
            })}
          </Card.Content>
        </Card>
      )}
    </>
  )
}