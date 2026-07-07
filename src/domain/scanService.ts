import { ProductIdentifier } from "@/db/schema";

export type ProductIdentifierType = ProductIdentifier["type"];

export type IdentifierCandidate = {
  type: ProductIdentifierType;
  value: string;
};

function normalizeIdentifierValue(type: ProductIdentifierType, value: string) {
  const trimmed = value.trim();

  if (type === "GTIN" || type === "EAN13") {
    return trimmed.replace(/\D+/g, "");
  }

  return trimmed;
}

function uniqueCandidates(candidates: IdentifierCandidate[]) {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.value}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function normalizeProductIdentifier(
  type: ProductIdentifierType,
  value: string,
): IdentifierCandidate {
  return {
    type,
    value: normalizeIdentifierValue(type, value),
  };
}

export function getIdentifierLookupCandidates(
  type: ProductIdentifierType,
  value: string,
): IdentifierCandidate[] {
  const primary = normalizeProductIdentifier(type, value);
  const candidates: IdentifierCandidate[] = [primary];

  if ((primary.type === "GTIN" || primary.type === "EAN13") && /^\d+$/.test(primary.value)) {
    if (primary.value.length === 14 && primary.value.startsWith("0")) {
      candidates.push({
        type: "EAN13",
        value: primary.value.slice(1),
      });
    }

    if (primary.value.length === 13) {
      candidates.push({
        type: "EAN13",
        value: primary.value,
      });
      candidates.push({
        type: "GTIN",
        value: `0${primary.value}`,
      });
    }
  }

  return uniqueCandidates(candidates).filter((candidate) => candidate.value.length > 0);
}
