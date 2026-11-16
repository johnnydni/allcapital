/** Money is handled as integer cents everywhere; these helpers are the only place it becomes text. */

const WITH_CENTS = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

export function formatCents(cents: number): string {
  return WITH_CENTS.format(cents / 100);
}

/** For rounded figures such as estimates, where cents would suggest false precision. */
export function formatWhole(cents: number): string {
  return WHOLE.format(Math.round(cents / 100));
}

/** Parses German notation ("17.486,13", "17486", "17 486,5"). Returns null if it is not a valid amount. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[\s.€]/g, "").replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole = "0", frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function parseInteger(input: string): number | null {
  const cleaned = input.replace(/[\s.]/g, "");
  return /^\d{1,9}$/.test(cleaned) ? Number(cleaned) : null;
}
