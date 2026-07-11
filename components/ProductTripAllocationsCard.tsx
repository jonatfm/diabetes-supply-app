import { useUpcomingHolidayAllocationsForProduct } from "@/src/data/hooks/useUpcomingHolidayAllocationsForProduct";
import { View } from "react-native";
import { Card, Chip, DataTable, Icon, Text, useTheme } from "react-native-paper";

export default function ProductTripAllocationsCard({ productId }: { productId: string }) {
  const theme = useTheme();
  const allocationsQ = useUpcomingHolidayAllocationsForProduct(productId);
  const allocations = allocationsQ.data ?? [];

  if (allocationsQ.isPending || allocations.length === 0) return null;

  const trips = Array.from(
    allocations.reduce((grouped, allocation) => {
      const existing = grouped.get(allocation.holidayId);
      if (existing) {
        existing.allocations.push(allocation);
      } else {
        grouped.set(allocation.holidayId, {
          destination: allocation.destination,
          startDate: allocation.startDate,
          endDate: allocation.endDate,
          state: allocation.state,
          allocations: [allocation],
        });
      }
      return grouped;
    }, new Map<string, {
      destination: string;
      startDate: string | null;
      endDate: string | null;
      state: "PLANNED" | "PACKED" | "ACTIVE" | "COMPLETE";
      allocations: typeof allocations;
    }>()).values(),
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon source="bag-suitcase" size={24} color={theme.colors.primary} />
        <Text variant="titleLarge">Upcoming Trip Packing</Text>
      </View>
      <Card mode="elevated" elevation={2}>
        <Card.Content style={{ gap: 16 }}>
          {trips.map((trip, tripIndex) => {
            const tripDates = trip.startDate && trip.endDate
              ? `${trip.startDate} to ${trip.endDate}`
              : "Dates not set";
            const totalReserved = trip.allocations.reduce((sum, allocation) => sum + allocation.originalUnits, 0);

            return (
              <View key={`${trip.destination}-${tripIndex}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Icon source="map-marker" size={20} color={theme.colors.primary} />
                  <Text variant="titleMedium" style={{ color: theme.colors.primary, fontWeight: "bold" }}>
                    {trip.destination}
                  </Text>
                  <Chip compact mode="flat">{trip.state === "PACKED" ? "Packed" : "Packing"}</Chip>
                </View>
                <Text variant="bodyMedium" style={{ marginTop: 4, color: theme.colors.onSurfaceVariant }}>
                  {tripDates} · {totalReserved} unit{totalReserved === 1 ? "" : "s"} reserved
                </Text>
                <DataTable style={{ marginTop: 4 }}>
                  <DataTable.Header>
                    <DataTable.Title>Pack</DataTable.Title>
                    <DataTable.Title numeric>Reserved</DataTable.Title>
                    <DataTable.Title numeric>Expiry</DataTable.Title>
                  </DataTable.Header>
                  {trip.allocations.map((allocation) => {
                    const serial = allocation.ais?.["21"];
                    const packReference = serial
                      ? serial.length > 8 ? `${serial.slice(0, 4)}...${serial.slice(-4)}` : serial
                      : allocation.packId.slice(-8);

                    return (
                      <DataTable.Row key={allocation.allocationId}>
                        <DataTable.Cell>{packReference}</DataTable.Cell>
                        <DataTable.Cell numeric>{allocation.originalUnits}</DataTable.Cell>
                        <DataTable.Cell numeric>{allocation.expiry ? new Date(allocation.expiry).toLocaleDateString() : "–"}</DataTable.Cell>
                      </DataTable.Row>
                    );
                  })}
                </DataTable>
                {tripIndex < trips.length - 1 && <View style={{ height: 1, backgroundColor: theme.colors.outlineVariant, marginTop: 16 }} />}
              </View>
            );
          })}
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Reserved units are excluded from normal consumption until the trip starts or is repacked.
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
}
