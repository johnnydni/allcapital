import type { PropertyKind } from "./api";

export const PROPERTY_KIND_LABEL: Record<PropertyKind, string> = {
  haus: "Haus",
  wohnung: "Wohnung",
  garage: "Garage/Stellplatz",
  gewerbe: "Gewerbeimmobilie",
};

export const STATES = [
  "Baden-Württemberg",
  "Bayern",
  "Berlin",
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Hessen",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Nordrhein-Westfalen",
  "Rheinland-Pfalz",
  "Saarland",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];

export function renovationText(year: number): string {
  const years = year - new Date().getFullYear();
  if (years <= 0) return "dieses Jahr";
  return `in ${years} ${years === 1 ? "Jahr" : "Jahren"}`;
}
