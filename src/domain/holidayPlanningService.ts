import { Holiday, Pack } from "@/db/schema";

export type TripExpiryWarning = {
  packId: string;
  productId: string;
  productName: string;
  expiry: string;
  kind: "EXPIRES_BEFORE_TRIP" | "EXPIRES_DURING_TRIP";
};

export type TripPackCandidate = {
  pack: Pack;
  productName: string;
};

function dateOnlyTime(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

export function buildTripExpiryWarnings(
  holiday: Holiday,
  candidates: TripPackCandidate[],
): TripExpiryWarning[] {
  if (!holiday.startDate || !holiday.endDate) {
    return [];
  }

  const startTime = dateOnlyTime(holiday.startDate);
  const endTime = dateOnlyTime(holiday.endDate);
  if (startTime === null || endTime === null) {
    return [];
  }

  const warnings: TripExpiryWarning[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.pack.expiry) {
      continue;
    }

    const expiryTime = dateOnlyTime(candidate.pack.expiry);
    if (expiryTime === null || expiryTime > endTime) {
      continue;
    }

    const kind = expiryTime < startTime ? "EXPIRES_BEFORE_TRIP" : "EXPIRES_DURING_TRIP";
    const key = `${candidate.pack.id}:${kind}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    warnings.push({
      packId: candidate.pack.id,
      productId: candidate.pack.productId,
      productName: candidate.productName,
      expiry: candidate.pack.expiry,
      kind,
    });
  }

  return warnings;
}
