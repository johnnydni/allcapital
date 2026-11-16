import type { Condition, Vehicle, VehicleKind } from "./api";

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

export function currentValue(v: Vehicle): number {
  return v.history[v.history.length - 1]?.cents ?? 0;
}

export function totalValue(vehicles: Vehicle[]): number {
  return vehicles.reduce((sum, v) => sum + currentValue(v), 0);
}

/** Change between the first and the latest recorded value, as a fraction. Null with fewer than two values. */
export function valueChange(v: Vehicle): number | null {
  const first = v.history[0]?.cents;
  if (v.history.length < 2 || !first) return null;
  return (currentValue(v) - first) / first;
}
