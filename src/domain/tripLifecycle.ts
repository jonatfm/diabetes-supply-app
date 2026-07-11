export type TripState = "PLANNED" | "PACKED" | "ACTIVE" | "COMPLETE";

export function canDeleteTrip(trip: { state: TripState; startedAt: number | null }): boolean {
  return trip.startedAt === null && (trip.state === "PLANNED" || trip.state === "PACKED");
}

export function canTransitionTrip(
  trip: { state: TripState; startedAt: number | null },
  nextState: TripState,
): boolean {
  if (trip.state === "PLANNED" && nextState === "PACKED") return true;
  if (trip.state === "PACKED" && trip.startedAt === null) {
    return nextState === "PLANNED" || nextState === "ACTIVE";
  }
  return trip.state === "ACTIVE" && nextState === "COMPLETE";
}

export function isValidPackedUnitCount(units: number): boolean {
  return Number.isInteger(units) && units > 0;
}
