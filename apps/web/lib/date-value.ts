/**
 * Single source of truth for DATE / TIMELINE cell values.
 *
 * Dates are stored as plain "YYYY-MM-DD" strings (no time, no timezone) so a
 * date never shifts by a day between users in different timezones.
 * Older values may be full ISO timestamps — parseDateValue still reads them.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date → "YYYY-MM-DD". */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Stored value → Date at LOCAL midnight (or null).
 * "YYYY-MM-DD" is parsed as local (new Date("YYYY-MM-DD") would be UTC and
 * show the previous day west of UTC). Legacy ISO timestamps are parsed
 * normally and truncated to their local calendar day.
 */
export function parseDateValue(raw: unknown): Date | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    return isNaN(raw.getTime())
      ? null
      : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  const s = String(raw).trim();
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
