/**
 * Date utility functions for medical supply tracking.
 * 
 * CRITICAL: These functions handle expiry dates for medical products.
 * Incorrect date handling could lead to use of expired medical supplies.
 * 
 * GS1 Standard Reference:
 * - Date format: YYMMDD (6 digits)
 * - Day "00" indicates the last day of the month
 * - Year interpretation: 00-49 = 2000-2049, 50-99 = 1950-1999
 */

/**
 * Gets the last day of a given month.
 * 
 * @param year - 4-digit year
 * @param month - 1-indexed month (1 = January, 12 = December)
 * @returns The last day of the month (28, 29, 30, or 31)
 */
export function getLastDayOfMonth(year: number, month: number): number {
  // Using day 0 of the next month gives us the last day of the target month
  // Since JavaScript Date month is 0-indexed, passing our 1-indexed month
  // effectively gives us the next month, and day 0 gives the previous day
  return new Date(year, month, 0).getDate();
}

/**
 * Expands a 2-digit year to a 4-digit year per GS1 specification.
 * 
 * Per GS1 General Specifications:
 * - 00-49 → 2000-2049
 * - 50-99 → 1950-1999
 * 
 * @param yy - 2-digit year (0-99)
 * @returns 4-digit year
 */
export function expandYear(yy: number): number {
  return yy < 50 ? 2000 + yy : 1900 + yy;
}

/**
 * Normalizes various date formats to YYYY-MM-DD.
 * 
 * Supported input formats:
 * - YYMMDD (GS1 standard, e.g., "270100" → "2027-01-31")
 * - YYMMDD with day 00 (last day of month, e.g., "270100" → "2027-01-31")
 * - YYYY-MM-DD (already formatted, e.g., "2027-01-15" → "2027-01-15")
 * - YYYY-MM-00 (day 00 meaning last day, e.g., "2027-01-00" → "2027-01-31")
 * - YYYY-MM (year-month only, e.g., "2027-01" → "2027-01-31")
 * - YYMM (4 digits, year-month only, e.g., "2701" → "2027-01-31")
 * 
 * Per GS1 specification, day "00" indicates the last day of the month.
 * This is critical for medical products where expiry dates must be accurate.
 * 
 * @param dateStr - Input date string in any supported format
 * @returns Normalized date string in YYYY-MM-DD format, or undefined if input is empty
 * 
 * @example
 * normalizeDate("270100")     // "2027-01-31" (GS1 YYMMDD with day 00)
 * normalizeDate("270115")     // "2027-01-15" (GS1 YYMMDD)
 * normalizeDate("2027-01-00") // "2027-01-31" (day 00 = last day)
 * normalizeDate("2027-01")    // "2027-01-31" (year-month only)
 * normalizeDate("2027-01-15") // "2027-01-15" (already formatted)
 */
export function normalizeExpiryDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;

  // Trim whitespace
  dateStr = dateStr.trim();

  // Pattern 1: YYMMDD (6 digits, GS1 standard)
  if (/^\d{6}$/.test(dateStr)) {
    const yy = parseInt(dateStr.slice(0, 2), 10);
    const mm = parseInt(dateStr.slice(2, 4), 10);
    const dd = parseInt(dateStr.slice(4, 6), 10);
    const year = expandYear(yy);
    
    // GS1 spec: day "00" means last day of month
    const day = dd === 0 ? getLastDayOfMonth(year, mm) : dd;
    
    return `${year}-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Pattern 2: YYYY-MM-00 (day is 00, meaning last day of month)
  if (/^\d{4}-\d{2}-00$/.test(dateStr)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(5, 7), 10);
    const lastDay = getLastDayOfMonth(year, month);
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // Pattern 3: YYYY-MM-DD (already properly formatted)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Pattern 4: YYYY-MM (year-month only, treat as last day of month)
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(5, 7), 10);
    const lastDay = getLastDayOfMonth(year, month);
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }

  // Pattern 5: YYMM (4 digits, year-month only, treat as last day of month)
  if (/^\d{4}$/.test(dateStr)) {
    const yy = parseInt(dateStr.slice(0, 2), 10);
    const mm = parseInt(dateStr.slice(2, 4), 10);
    // Validate month is 01-12
    if (mm >= 1 && mm <= 12) {
      const year = expandYear(yy);
      const lastDay = getLastDayOfMonth(year, mm);
      return `${year}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  // Return unchanged if format is not recognized
  // Log a warning in development to catch unexpected formats
  console.warn(`[normalizeExpiryDate] Unrecognized date format: "${dateStr}"`);
  return dateStr;
}

/**
 * Formats a YYYY-MM-DD date string for display in DD.MM.YYYY format.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string in DD.MM.YYYY format, or original if not in expected format
 */
export function formatDateForDisplay(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  }

  return dateStr;
}

/**
 * Parses a YYYY-MM-DD date string into a Date object.
 * 
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object, or null if parsing fails
 */
export function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }

  return null;
}
