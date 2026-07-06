import { Pack, ProductIdentifier } from "@/db/schema";

export type ConsumeSortPreference = "expiry" | "fewest_units";

export type ChoosePackForConsumptionParams = {
  packs: Pack[];
  productIdentifiers?: ProductIdentifier[];
  sortPreference: ConsumeSortPreference;
  now?: Date;
  activeHolidayPackUnits?: Record<string, number>;
  holidayReservedByPack?: Record<string, number>;
};

export type ChosenPackForConsumption = {
  pack: Pack;
  identifier: string;
  identifierType: "Serial" | "Code";
  unitsOnHoliday?: number;
};

function isPackExpired(pack: Pack, now: Date) {
  if (!pack.expiry) return false;
  return new Date(pack.expiry) < now;
}

function getPackIdentifier(pack: Pack, productIdentifiers?: ProductIdentifier[]) {
  const serial = pack.ais?.["21"];
  if (serial) {
    return {
      identifier: serial,
      identifierType: "Serial" as const,
    };
  }

  return {
    identifier: productIdentifiers?.[0]?.value ?? "N/A",
    identifierType: "Code" as const,
  };
}

export function choosePackForConsumption(params: ChoosePackForConsumptionParams): ChosenPackForConsumption | null {
  const {
    packs,
    productIdentifiers,
    sortPreference,
    now = new Date(),
    activeHolidayPackUnits,
    holidayReservedByPack = {},
  } = params;

  const onActiveHoliday = !!activeHolidayPackUnits;
  const validPacks = packs
    .filter((pack) => !isPackExpired(pack, now))
    .filter((pack) => {
      if (onActiveHoliday) {
        return (activeHolidayPackUnits[pack.id] ?? 0) > 0;
      }

      const reserved = holidayReservedByPack[pack.id] ?? 0;
      return pack.unitsRemaining - reserved > 0;
    });

  if (validPacks.length === 0) {
    return null;
  }

  const sortedPacks = [...validPacks].sort((a, b) => {
    if (sortPreference === "fewest_units") {
      return a.unitsRemaining - b.unitsRemaining;
    }

    const aExpiry = a.expiry ? new Date(a.expiry).getTime() : Infinity;
    const bExpiry = b.expiry ? new Date(b.expiry).getTime() : Infinity;
    if (aExpiry !== bExpiry) return aExpiry - bExpiry;
    return a.createdAt - b.createdAt;
  });

  const pack = sortedPacks[0];
  const { identifier, identifierType } = getPackIdentifier(pack, productIdentifiers);
  const unitsOnHoliday = holidayReservedByPack[pack.id] ?? 0;

  return {
    pack,
    identifier,
    identifierType,
    unitsOnHoliday: unitsOnHoliday > 0 ? unitsOnHoliday : undefined,
  };
}
