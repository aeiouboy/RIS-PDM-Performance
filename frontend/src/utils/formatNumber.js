/**
 * Smart number formatter for dashboard display.
 * - Integers stay integers (no trailing zeros).
 * - Decimals limited to maxDecimals (default 1).
 * - Trailing ".0" / ".00" stripped.
 * - Returns "—" for null/undefined/NaN.
 * - Optionally suffix with unit.
 *
 * Examples:
 *   fmt(70)              → "70"
 *   fmt(70.0)            → "70"
 *   fmt(70.04)           → "70"           (rounds to 1 decimal then strips trailing zero)
 *   fmt(70.45)           → "70.5"
 *   fmt(904.8499999999)  → "904.8"
 *   fmt(0.5)             → "0.5"
 *   fmt(150.0, { unit: '%' }) → "150%"
 *   fmt(null)            → "—"
 */
export function fmt(value, { maxDecimals = 1, unit = '', integerOnly = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const decimals = integerOnly ? 0 : maxDecimals;
  // Round, then strip trailing zeros
  let s = n.toFixed(decimals);
  if (decimals > 0) s = s.replace(/\.?0+$/, '');
  return unit ? `${s}${unit}` : s;
}

/**
 * Convenience: integer-only formatter (rounds, no decimals).
 * fmt0(70.7)  → "71"
 * fmt0(904.84) → "905"
 */
export const fmt0 = (v, opts) => fmt(v, { ...opts, integerOnly: true });

/**
 * Convenience: percentage formatter, max 1 decimal, with % suffix.
 * pct(70.0)  → "70%"
 * pct(70.45) → "70.5%"
 * pct(0)     → "0%"
 */
export const pct = (v, opts) => fmt(v, { ...opts, unit: '%' });
