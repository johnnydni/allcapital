import type { Condition, JournalCategory, JournalEntry, ValuePoint, Vehicle, VehicleKind } from "./api";

type Valued = { history: ValuePoint[] };

export const CONDITION_LABEL: Record<Condition, string> = {
  schlecht: "Schlecht",
  mittel: "Mittel",
  gut: "Gut",
  sehr_gut: "Sehr gut",
};

export const KIND_LABEL: Record<VehicleKind, string> = {
  automobil: "Automobil",
  fahrrad: "Fahrräder",
  escooter: "E-Scooter",
  motorrad: "Motorräder",
};

export function currentValue(v: Valued): number {
  return v.history[v.history.length - 1]?.cents ?? 0;
}

export function totalValue(items: Valued[]): number {
  return items.reduce((sum, v) => sum + currentValue(v), 0);
}

/** Current minus first recorded value, summed. */
export function totalGain(items: Valued[]): number {
  return items.reduce((sum, v) => sum + currentValue(v) - (v.history[0]?.cents ?? 0), 0);
}

/** Change of a whole group since each item's first value, as a fraction. */
export function groupChange(items: Valued[]): number | null {
  const first = items.reduce((sum, v) => sum + (v.history[0]?.cents ?? 0), 0);
  if (!first || !items.some((v) => v.history.length > 1)) return null;
  return totalGain(items) / first;
}

/** Direction of the most recent value change: 1 up, -1 down, 0 unchanged. */
export function lastMove(v: Valued): number {
  const h = v.history;
  if (h.length < 2) return 0;
  return Math.sign(h[h.length - 1]!.cents - h[h.length - 2]!.cents);
}

/** Change between the first and the latest recorded value, as a fraction. Null with fewer than two values. */
export function valueChange(v: Valued): number | null {
  const first = v.history[0]?.cents;
  if (v.history.length < 2 || !first) return null;
  return (currentValue(v) - first) / first;
}

export type JournalSection = "kosten" | "wartung" | "reisen";

export const SECTION_CATEGORIES: Record<JournalSection, JournalCategory[]> = {
  kosten: ["steuer", "versicherung", "kraftstoff", "sonstiges"],
  wartung: ["werkstatt", "teile"],
  reisen: ["fahrt"],
};

export const CATEGORY_LABEL: Record<JournalCategory, string> = {
  steuer: "Kraftfahrzeugsteuer",
  versicherung: "Versicherung",
  kraftstoff: "Kraftstoff / Strom",
  sonstiges: "Sonstiges",
  werkstatt: "Werkstattbesuch",
  teile: "Teile",
  fahrt: "Fahrt",
};

/** Local calendar date as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function entriesOf(v: Vehicle, categories: JournalCategory[]): JournalEntry[] {
  return v.journal.filter((e) => categories.includes(e.category)).sort((a, b) => b.date.localeCompare(a.date));
}

/** Sum of the amounts booked in the current calendar year. */
export function yearSum(v: Vehicle, categories: JournalCategory[]): number {
  const year = todayIso().slice(0, 4);
  return entriesOf(v, categories)
    .filter((e) => e.date.startsWith(year))
    .reduce((sum, e) => sum + (e.amountCents ?? 0), 0);
}

export function totalKm(v: Vehicle): number {
  return entriesOf(v, ["fahrt"]).reduce((sum, e) => sum + (e.km ?? 0), 0);
}

/** Whole days from today until the given date; negative if it has passed. */
export function daysUntil(iso: string): number {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  const [ty = 0, tm = 1, td = 1] = todayIso().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

export function serviceText(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return `überfällig seit ${-days} ${days === -1 ? "Tag" : "Tagen"}`;
  if (days === 0) return "heute";
  return `${days} ${days === 1 ? "Tag" : "Tagen"}`;
}
