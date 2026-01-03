/**
 * GS1 Application Identifier (AI) Parser
 * Parses GS1 barcode strings into structured data
 */

export type GS1Field = {
  ai: string;
  value: string;
  name: string;
  description: string;
};

export type GS1Data = {
  raw: string;
  fields: GS1Field[];
};

// GS1 Application Identifier definitions
const GS1_AI_SPECS: Record<string, { name: string; description: string; length?: number }> = {
  '00': { name: 'SSCC', description: 'Serial Shipping Container Code', length: 18 },
  '01': { name: 'GTIN', description: 'Global Trade Item Number', length: 14 },
  '02': { name: 'CONTENT', description: 'Identification of trade items contained in a logistic unit', length: 14 },
  '03': { name: 'MTO GTIN', description: 'Identification of a Made-to-Order (MtO) trade item (GTIN)', length: 14 },
  '10': { name: 'BATCH/LOT', description: 'Batch or lot number' },
  '11': { name: 'PROD DATE', description: 'Production date (YYMMDD)', length: 6 },
  '12': { name: 'DUE DATE', description: 'Due date for amount on payment slip (YYMMDD)', length: 6 },
  '13': { name: 'PACK DATE', description: 'Packaging date (YYMMDD)', length: 6 },
  '15': { name: 'BEST BEFORE', description: 'Best before date (YYMMDD)', length: 6 },
  '16': { name: 'SELL BY', description: 'Sell by date (YYMMDD)', length: 6 },
  '17': { name: 'USE BY', description: 'Expiration date (YYMMDD)', length: 6 },
  '20': { name: 'VARIANT', description: 'Internal product variant', length: 2 },
  '21': { name: 'SERIAL', description: 'Serial number' },
  '22': { name: 'CPV', description: 'Consumer product variant' },
};

/**
 * Parses a GS1 barcode string into structured data
 * @param gs1String - The GS1 encoded string (may use FNC1 as group separator or parentheses)
 * @returns Parsed GS1 data with all identified fields
 */
export function parseGS1(gs1String: string): GS1Data {
  const fields: GS1Field[] = [];
  
  // Remove parentheses if present (human-readable format)
  const normalizedString = gs1String.replace(/[()]/g, '');
  
  let position = 0;
  
  while (position < normalizedString.length) {
    // Try to match an AI (2-4 digits, but we'll check 2 first as most common)
    let ai: string | null = null;
    let spec: { name: string; description: string; length?: number } | null = null;
    
    // Try 2-digit AI first (most common)
    if (position + 2 <= normalizedString.length) {
      const potentialAI = normalizedString.substring(position, position + 2);
      if (GS1_AI_SPECS[potentialAI]) {
        ai = potentialAI;
        spec = GS1_AI_SPECS[potentialAI];
      }
    }
    
    // Try 3-digit AI
    if (!ai && position + 3 <= normalizedString.length) {
      const potentialAI = normalizedString.substring(position, position + 3);
      if (GS1_AI_SPECS[potentialAI]) {
        ai = potentialAI;
        spec = GS1_AI_SPECS[potentialAI];
      }
    }
    
    // Try 4-digit AI
    if (!ai && position + 4 <= normalizedString.length) {
      const potentialAI = normalizedString.substring(position, position + 4);
      if (GS1_AI_SPECS[potentialAI]) {
        ai = potentialAI;
        spec = GS1_AI_SPECS[potentialAI];
      }
    }
    
    if (!ai || !spec) {
      // Unknown AI or end of valid data
      break;
    }
    
    position += ai.length;
    
    // Extract the value
    let value: string;
    
    if (spec.length) {
      // Fixed-length field
      value = normalizedString.substring(position, position + spec.length);
      position += spec.length;
    } else {
      // Variable-length field - read until FNC1 (character 29) or end
      const fnc1Index = normalizedString.indexOf(String.fromCharCode(29), position);
      if (fnc1Index !== -1) {
        value = normalizedString.substring(position, fnc1Index);
        position = fnc1Index + 1; // Skip the FNC1 character
      } else {
        // Read to end of string
        value = normalizedString.substring(position);
        position = normalizedString.length;
      }
    }
    
    fields.push({
      ai,
      value,
      name: spec.name,
      description: spec.description,
    });
  }
  
  return {
    raw: gs1String,
    fields,
  };
}

/**
 * Parses GS1 human-readable strings like (01)GTIN(10)LOT(17)EXP... into structured data.
 * Uses parentheses to delimit AI/value pairs, avoiding misinterpretation of fixed-length AIs.
 */
export function parseGS1HumanReadable(gs1String: string): GS1Data {
  const fields: GS1Field[] = [];
  const re = /\((\d{2,4})\)([^()]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(gs1String)) !== null) {
    const ai = m[1];
    const value = m[2].trim();
    const spec = GS1_AI_SPECS[ai];
    fields.push({
      ai,
      value,
      name: spec?.name ?? `AI ${ai}`,
      description: spec?.description ?? 'Unknown Application Identifier',
    });
  }
  return { raw: gs1String, fields };
}

/**
 * Unified GS1 parser that detects format and dispatches to the appropriate parser.
 * - If parentheses are present, uses human-readable parser.
 * - Otherwise, uses FNC1/fixed-length aware parser.
 */
export function parseGS1Unified(gs1String: string): GS1Data {
  if (gs1String.includes('(')) {
    return parseGS1HumanReadable(gs1String);
  }
  return parseGS1(gs1String);
}

/**
 * Convenience: Build a map of AI -> value from parsed GS1 data.
 */
export function getAIMap(data: GS1Data): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of data.fields) {
    map[f.ai] = f.value;
  }
  return map;
}

/**
 * Detect barcode format and extract appropriate identifier.
 */
export function detectBarcodeFormat(text: string): {
  format: 'GS1' | 'EAN13' | 'UNKNOWN';
  identifier: string;
  identifierType: 'GTIN' | 'EAN13' | null;
} {
  // Check if it looks like GS1 (has parentheses or starts with AI codes)
  if (text.includes('(') || /^(00|01|02|03|10|11|12|13|15|16|17|20|21|22)/.test(text)) {
    return {
      format: 'GS1',
      identifier: '',
      identifierType: null,
    };
  }
  
  // Check if it's EAN13 (13 digits)
  if (/^\d{13}$/.test(text)) {
    return {
      format: 'EAN13',
      identifier: text,
      identifierType: 'EAN13',
    };
  }
  
  return {
    format: 'UNKNOWN',
    identifier: '',
    identifierType: null,
  };
}

/**
 * Convenience fields commonly used in medical products.
 * Now supports multiple barcode formats.
 */
export function getConvenienceFields(data: GS1Data | string): {
  identifier: string;
  identifierType: 'GTIN' | 'EAN13' | null;
  lot: string;
  expiry: string;
  serial: string;
  productionDate: string;
} {
  // If passed a string (e.g., EAN13), detect format
  if (typeof data === 'string') {
    const detected = detectBarcodeFormat(data);
    return {
      identifier: detected.identifier,
      identifierType: detected.identifierType,
      lot: '',
      expiry: '',
      serial: '',
      productionDate: '',
    };
  }
  
  // Otherwise, it's GS1Data
  const map = getAIMap(data);
  const gtinRaw = map['01'] ?? '';
  const gtin = gtinRaw.replace(/\D+/g, '');
  
  return {
    identifier: gtin,
    identifierType: gtin ? 'GTIN' : null,
    lot: (map['10'] ?? '').trim(),
    expiry: (map['17'] ?? '').trim(),
    serial: (map['21'] ?? '').trim(),
    productionDate: (map['11'] ?? '').trim(),
  };
}

/**
 * Formats GS1 data into a human-readable string with parentheses
 * @param data - Parsed GS1 data
 * @returns Human-readable formatted string
 */
export function formatGS1(data: GS1Data): string {
  return data.fields.map(field => `(${field.ai})${field.value}`).join('');
}

/**
 * Gets a specific field from parsed GS1 data by AI or name
 * @param data - Parsed GS1 data
 * @param aiOrName - Application Identifier (e.g., "01") or name (e.g., "GTIN")
 * @returns The field if found, otherwise undefined
 */
export function getField(data: GS1Data, aiOrName: string): GS1Field | undefined {
  return data.fields.find(f => f.ai === aiOrName || f.name === aiOrName);
}

/**
 * Parses a GS1 date field (YYMMDD format) into a Date object
 * @param dateString - Six-digit date string in YYMMDD format
 * @returns Date object
 */
export function parseGS1Date(dateString: string): Date {
  if (dateString.length !== 6) {
    throw new Error('GS1 date must be 6 digits (YYMMDD)');
  }
  
  const yy = parseInt(dateString.substring(0, 2), 10);
  const mm = parseInt(dateString.substring(2, 4), 10);
  const dd = parseInt(dateString.substring(4, 6), 10);
  
  // Assume dates 00-49 are 2000-2049, 50-99 are 1950-1999
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  
  return new Date(year, mm - 1, dd);
}
