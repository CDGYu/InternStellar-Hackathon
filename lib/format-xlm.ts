/**
 * Stroops → display conversions. UI boundary only.
 *
 * CLAUDE.md / schema invariant: money lives as bigint stroops in the DB and
 * across API boundaries. Convert to XLM only here, only for display, and
 * never round-trip back to stroops via the float.
 *
 *   1 XLM = 10,000,000 stroops
 */
const STROOPS_PER_XLM = 10_000_000n;

export type StroopInput = bigint | number | string | null | undefined;

function toBigint(value: StroopInput): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  // Supabase returns bigint columns as string when the value exceeds the
  // JS safe-integer range; accept that shape directly.
  return BigInt(value);
}

/**
 * Format stroops as an XLM string with up to 4 decimals (per spec).
 * Trims trailing zeros and the decimal point when the result is whole.
 *
 *   formatXlm(34_500_000n)         → "3.45"
 *   formatXlm(10_000_000n)         → "10"
 *   formatXlm("123456789")         → "12.3457"   (rounded to 4 dp)
 */
export function formatXlm(value: StroopInput, opts?: { maxDecimals?: number }): string {
  const maxDecimals = opts?.maxDecimals ?? 4;
  const stroops = toBigint(value);

  const whole = stroops / STROOPS_PER_XLM;
  const remainder = stroops % STROOPS_PER_XLM;

  if (remainder === 0n) return whole.toString();

  // Pad with leading zeros so the fractional part is exactly 7 digits, then
  // truncate-then-round to maxDecimals by inspecting the next digit.
  const frac7 = remainder.toString().padStart(7, "0");
  if (maxDecimals >= 7) {
    return `${whole}.${frac7.replace(/0+$/, "")}`;
  }
  const keep = frac7.slice(0, maxDecimals);
  const nextDigit = frac7.charAt(maxDecimals);
  let rounded = keep;
  if (nextDigit && Number(nextDigit) >= 5) {
    // Carry. We do this with bigint to keep precision past JS safe ints.
    const bumped = (BigInt(keep) + 1n).toString().padStart(maxDecimals, "0");
    if (bumped.length > maxDecimals) {
      // Carried out of the fractional part — bump the whole.
      const newWhole = whole + 1n;
      return newWhole.toString();
    }
    rounded = bumped;
  }
  const trimmed = rounded.replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole.toString();
}

/** Same value with the " XLM" suffix already attached, e.g. "3.45 XLM". */
export function formatXlmWithUnit(value: StroopInput, opts?: { maxDecimals?: number }): string {
  return `${formatXlm(value, opts)} XLM`;
}

/**
 * Parse a user-entered XLM string into stroops (bigint).
 *
 * Accepts "3.45", "10", ".5", "0.0000001" (7-decimal stroop precision).
 * Returns null for empty / non-numeric / negative input, or for inputs
 * with more than 7 fractional digits (sub-stroop precision is a bug).
 */
export function parseXlmToStroops(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d*(?:\.\d*)?$/.test(trimmed)) return null;

  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 7) return null;

  const wholePart = whole === "" ? 0n : BigInt(whole);
  const fracPadded = frac.padEnd(7, "0");
  const fracPart = fracPadded === "" ? 0n : BigInt(fracPadded);

  return wholePart * STROOPS_PER_XLM + fracPart;
}

/** Truncate a 64-char hex tx hash for display: "a1b2c3d4…d8e9". */
export function truncateHash(hash: string | null | undefined, head = 8, tail = 4): string {
  if (!hash) return "—";
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
