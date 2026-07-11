import { Pack, Product, ProductIdentifier } from "@/db/schema";
import { coloredDotsRepo } from "@/src/data/coloredDotsRepo";
import { holidayRepo } from "@/src/data/holidayRepo";
import { choosePackForConsumption, ConsumeSortPreference } from "@/src/domain/inventoryService";

type Db = Parameters<typeof holidayRepo>[0];

export type ConsumptionDialogPackInfo = {
  expiryDate: Date | null;
  identifier: string;
  identifierType: "Serial" | "Code";
  unitsLeftInPack: number;
  packId: string;
  coloredDotIds?: string[];
  unitsOnHoliday?: number;
  previousTrips: { destination: string; endDate: string | null; allocatedUnits: number }[];
};

export async function buildConsumptionDialogPackInfo(params: {
  db: Db;
  productId: string;
  product: Product | null | undefined;
  packs: Pack[];
  productIdentifiers?: ProductIdentifier[];
  sortPreference: ConsumeSortPreference;
  coloredDotsEnabled: boolean;
  hasActiveHoliday: boolean;
  isOnHoliday: boolean;
  activeHolidayId?: string | null;
}): Promise<ConsumptionDialogPackInfo | null> {
  const onActiveHoliday = params.hasActiveHoliday && params.isOnHoliday && params.activeHolidayId;
  let activeHolidayPackUnits: Record<string, number> | undefined = undefined;
  if (onActiveHoliday) {
    activeHolidayPackUnits = {};
    const packsForHoliday = await holidayRepo(params.db).getPacksForHoliday(params.activeHolidayId!);
    for (const pack of packsForHoliday) {
      activeHolidayPackUnits[pack.packId] = (activeHolidayPackUnits[pack.packId] ?? 0) + pack.units;
    }
  }

  const holidayReservedByPack = onActiveHoliday
    ? {}
    : await holidayRepo(params.db).getHolidayReservedUnitsByPack(params.productId);

  const chosenPackInfo = choosePackForConsumption({
    packs: params.packs,
    productIdentifiers: params.productIdentifiers,
    sortPreference: params.sortPreference,
    activeHolidayPackUnits,
    holidayReservedByPack,
  });

  if (!chosenPackInfo) {
    return null;
  }

  const chosenPack = chosenPackInfo.pack;
  const coloredDotIds = params.coloredDotsEnabled && params.product?.useColoredDots
    ? (await coloredDotsRepo(params.db).getAssignmentByPackId(chosenPack.id))?.dotIds || []
    : undefined;
  const previousTrips = await holidayRepo(params.db).getCompletedHolidayAllocationsForPack(chosenPack.id);

  return {
    expiryDate: chosenPack.expiry ? new Date(chosenPack.expiry) : null,
    identifier: chosenPackInfo.identifier,
    identifierType: chosenPackInfo.identifierType,
    unitsLeftInPack: chosenPack.unitsRemaining,
    packId: chosenPack.id,
    unitsOnHoliday: chosenPackInfo.unitsOnHoliday,
    coloredDotIds,
    previousTrips: previousTrips.map((trip) => ({
      destination: trip.destination,
      endDate: trip.endDate,
      allocatedUnits: trip.originalUnits,
    })),
  };
}
