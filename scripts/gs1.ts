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
// Note: Variable-length AIs (without 'length') require FNC1 separator or heuristic parsing
export const GS1_AI_SPECS: Record<string, { name: string; description: string; length?: number; maxLength?: number }> = {
  '00': { name: 'SSCC', description: 'Serial Shipping Container Code', length: 18 },
  '01': { name: 'GTIN', description: 'Global Trade Item Number', length: 14 },
  '02': { name: 'CONTENT', description: 'Identification of trade items contained in a logistic unit', length: 14 },
  '03': { name: 'MTO GTIN', description: 'Identification of a Made-to-Order (MtO) trade item (GTIN)', length: 14 },
  '10': { name: 'BATCH/LOT', description: 'Batch or lot number', maxLength: 20 },
  '11': { name: 'PROD DATE', description: 'Production date (YYMMDD)', length: 6 },
  '12': { name: 'DUE DATE', description: 'Due date for amount on payment slip (YYMMDD)', length: 6 },
  '13': { name: 'PACK DATE', description: 'Packaging date (YYMMDD)', length: 6 },
  '15': { name: 'BEST BEFORE', description: 'Best before date (YYMMDD)', length: 6 },
  '16': { name: 'SELL BY', description: 'Sell by date (YYMMDD)', length: 6 },
  '17': { name: 'USE BY', description: 'Expiration date (YYMMDD)', length: 6 },
  '20': { name: 'VARIANT', description: 'Internal product variant', length: 2 },
  '21': { name: 'SERIAL', description: 'Serial number', maxLength: 20 },
  '22': { name: 'CPV', description: 'Consumer product variant', maxLength: 20 },
};

/**
 * Find the next valid AI starting position within a string.
 * Prioritizes fixed-length AIs (especially dates) as they are more reliable boundaries.
 * Excludes AIs that have already been parsed to avoid false positives from repeated AI codes.
 * Returns the position where a known AI starts, or null if none found.
 */
function findNextAIPosition(str: string, startPos: number, seenAIs: Set<string> = new Set()): { position: number; ai: string } | null {
  // We need to scan through the string looking for positions where a valid AI could start
  // Strategy: Find all candidate positions and pick the best one
  // Priority: Fixed-length AIs (dates, etc.) > Variable-length AIs
  // Exclude AIs already seen (unless they're commonly repeated, which is rare in practice)
  
  const dateAIs = ['11', '12', '13', '15', '16', '17'];
  const fixedLengthCandidates: { position: number; ai: string }[] = [];
  const variableLengthCandidates: { position: number; ai: string }[] = [];
  
  for (let pos = startPos; pos < str.length - 1; pos++) {
    // Check 2-digit AIs
    if (pos + 2 <= str.length) {
      const potentialAI = str.substring(pos, pos + 2);
      const spec = GS1_AI_SPECS[potentialAI];
      
      if (spec) {
        // For date AIs, validate that what follows looks like a valid date (YYMMDD)
        if (dateAIs.includes(potentialAI)) {
          if (pos + 2 + 6 <= str.length) {
            const dateCandidate = str.substring(pos + 2, pos + 2 + 6);
            if (isValidGS1Date(dateCandidate)) {
              fixedLengthCandidates.push({ position: pos, ai: potentialAI });
            }
          }
        } else if (spec.length) {
          // Other fixed-length AIs
          if (pos + 2 + spec.length <= str.length) {
            fixedLengthCandidates.push({ position: pos, ai: potentialAI });
          }
        } else {
          // Variable-length AI - less reliable as a boundary
          // Skip if already seen (likely a false positive)
          if (!seenAIs.has(potentialAI)) {
            variableLengthCandidates.push({ position: pos, ai: potentialAI });
          }
        }
      }
    }
    
    // Check 3-digit AIs
    if (pos + 3 <= str.length) {
      const potentialAI = str.substring(pos, pos + 3);
      const spec = GS1_AI_SPECS[potentialAI];
      if (spec) {
        if (spec.length) {
          fixedLengthCandidates.push({ position: pos, ai: potentialAI });
        } else if (!seenAIs.has(potentialAI)) {
          variableLengthCandidates.push({ position: pos, ai: potentialAI });
        }
      }
    }
    
    // Check 4-digit AIs
    if (pos + 4 <= str.length) {
      const potentialAI = str.substring(pos, pos + 4);
      const spec = GS1_AI_SPECS[potentialAI];
      if (spec) {
        if (spec.length) {
          fixedLengthCandidates.push({ position: pos, ai: potentialAI });
        } else if (!seenAIs.has(potentialAI)) {
          variableLengthCandidates.push({ position: pos, ai: potentialAI });
        }
      }
    }
  }
  
  // Prefer the earliest fixed-length AI as it's more reliable
  if (fixedLengthCandidates.length > 0) {
    // Sort by position and return the earliest
    fixedLengthCandidates.sort((a, b) => a.position - b.position);
    return fixedLengthCandidates[0];
  }
  
  // Fall back to variable-length AIs, but only if they appear after a reasonable 
  // minimum length for the current field (at least 1 character)
  if (variableLengthCandidates.length > 0) {
    variableLengthCandidates.sort((a, b) => a.position - b.position);
    return variableLengthCandidates[0];
  }
  
  return null;
}

/**
 * Validates if a 6-character string looks like a valid GS1 date (YYMMDD)
 */
function isValidGS1Date(str: string): boolean {
  if (str.length !== 6 || !/^\d{6}$/.test(str)) {
    return false;
  }
  
  const mm = parseInt(str.substring(2, 4), 10);
  const dd = parseInt(str.substring(4, 6), 10);
  
  // Month must be 01-12, day must be 01-31
  // (We're lenient on day validation since some months have fewer days)
  return mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
}

/**
 * Parses a GS1 barcode string into structured data.
 * Handles both FNC1-separated and concatenated (no separator) GS1 strings
 * by using lookahead to find embedded AIs within variable-length fields.
 * 
 * @param gs1String - The GS1 encoded string (may use FNC1 as group separator or parentheses)
 * @returns Parsed GS1 data with all identified fields
 */
export function parseGS1(gs1String: string): GS1Data {
  const fields: GS1Field[] = [];
  const seenAIs = new Set<string>(); // Track AIs we've already parsed
  
  // Remove parentheses if present (human-readable format)
  const normalizedString = gs1String.replace(/[()]/g, '');
  
  let position = 0;
  const FNC1 = String.fromCharCode(29);
  
  while (position < normalizedString.length) {
    // Skip any FNC1 separator characters (ASCII 29)
    while (position < normalizedString.length && normalizedString[position] === FNC1) {
      position++;
    }
    if (position >= normalizedString.length) break;
    
    // Try to match an AI (2-4 digits, but we'll check 2 first as most common)
    let ai: string | null = null;
    let spec: { name: string; description: string; length?: number; maxLength?: number } | null = null;
    
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
    seenAIs.add(ai); // Mark this AI as seen
    
    // Extract the value
    let value: string;
    
    if (spec.length) {
      // Fixed-length field
      value = normalizedString.substring(position, position + spec.length);
      position += spec.length;
    } else {
      // Variable-length field - need to determine where it ends
      const fnc1Index = normalizedString.indexOf(String.fromCharCode(29), position);
      
      if (fnc1Index !== -1 && fnc1Index < normalizedString.length) {
        // FNC1 separator found - use it as the boundary
        value = normalizedString.substring(position, fnc1Index);
        position = fnc1Index + 1; // Skip the FNC1 character
      } else {
        // No FNC1 separator - use lookahead to find the next valid AI
        // This handles concatenated GS1 strings without separators
        // Pass seenAIs to avoid false positives from repeated variable-length AI codes
        const remaining = normalizedString.substring(position);
        const nextAI = findNextAIPosition(remaining, 1, seenAIs); // Start at 1 to skip at least one char
        
        if (nextAI !== null) {
          // Found another AI embedded in the remaining string
          value = remaining.substring(0, nextAI.position);
          position += nextAI.position;
        } else {
          // No more AIs found - consume the rest
          value = remaining;
          position = normalizedString.length;
        }
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
  ais?: Record<string, string>;
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
  const aisDict = Object.fromEntries(
    data.fields.map(field => [field.ai, field.value])
  );
  
  return {
    identifier: gtin,
    identifierType: gtin ? 'GTIN' : null,
    lot: (map['10'] ?? '').trim(),
    expiry: (map['17'] ?? '').trim(),
    serial: (map['21'] ?? '').trim(),
    productionDate: (map['11'] ?? '').trim(),
    ais: aisDict,
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
