import { ProductIdentifier } from "@/db/schema";
import { GS1Data, detectBarcodeFormat, getConvenienceFields, parseGS1Unified } from "@/scripts/gs1";

export type ProductIdentifierType = ProductIdentifier["type"];

export type IdentifierCandidate = {
  type: ProductIdentifierType;
  value: string;
};

export type ProductIdentifierDetection = IdentifierCandidate & {
  format: "GS1" | "EAN13";
  gs1Data?: GS1Data;
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

export function getProductIdentifierFromCode(code: string): ProductIdentifierDetection | null {
  const detected = detectBarcodeFormat(code);

  if (detected.format === "GS1") {
    const parsed = parseGS1Unified(code);
    const convenience = getConvenienceFields(parsed);

    if (!convenience.identifier || !convenience.identifierType) {
      return null;
    }

    return {
      format: "GS1",
      type: convenience.identifierType,
      value: convenience.identifier,
      gs1Data: parsed,
    };
  }

  if (detected.format === "EAN13") {
    const convenience = getConvenienceFields(code);

    if (!convenience.identifier || !convenience.identifierType) {
      return null;
    }

    return {
      format: "EAN13",
      type: convenience.identifierType,
      value: convenience.identifier,
    };
  }

  return null;
}

export function selectProductIdentifierFromBarcodes<T extends { text?: string | null }>(
  barcodes: T[],
): { barcode: T; detection: ProductIdentifierDetection; index: number } | null {
  for (const [index, barcode] of barcodes.entries()) {
    if (!barcode.text) {
      continue;
    }

    const detection = getProductIdentifierFromCode(barcode.text);
    if (detection) {
      return {
        barcode,
        detection,
        index,
      };
    }
  }

  return null;
}
