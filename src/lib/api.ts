/**
 * Single gateway between the UI and the Rust backend.
 *
 * All secrets (passwords, hashes) are handled in Rust only. The UI passes a
 * password once per call and never stores it.
 *
 * Outside of Tauri (plain `vite dev` in a browser, or the web preview build) a
 * volatile in-memory mock is used so screens can be reviewed. The mock is
 * compiled out of the desktop app.
 */
import { invoke } from "@tauri-apps/api/core";

declare const __PREVIEW__: boolean;

export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  onboardingDone: boolean;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  language: Language;
  password: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
};

export type Language = "de" | "en";
export type Position = "schueler" | "student" | "berufstaetig" | "ruhestand";
export type AssetKind =
  | "bank"
  | "aktien"
  | "krypto"
  | "versicherung"
  | "eigentum"
  | "mobilitaet"
  | "tech"
  | "wertgegenstaende";
export type Hobby =
  | "gaming"
  | "filme"
  | "sport"
  | "reisen"
  | "kochen"
  | "schrauben"
  | "fotografie"
  | "andere";
export type Goal = "ueberblick" | "verwalten" | "umgang";
export type Knowledge = "neuling" | "basics" | "erfahren" | "profi";

export type OnboardingAnswers = {
  position: Position;
  assets: AssetKind[];
  hobbies: Hobby[];
  goals: Goal[];
  knowledge: Knowledge;
  improve: boolean;
};

export type VehicleKind = "automobil" | "fahrrad" | "escooter" | "motorrad";
export type Drive = "verbrenner" | "elektro";
export type Condition = "schlecht" | "mittel" | "gut" | "sehr_gut";
export type ValueSource = "estimate" | "manual";

export type VehicleDraft = {
  kind: VehicleKind;
  drive: Drive | null;
  brand: string;
  model: string;
  variant: string;
  buildYear: number;
  firstRegistration: number;
  condition: Condition;
  equipment: string[];
  powerPs: number | null;
  mileageKm: number | null;
  purchasePriceCents: number | null;
  purchaseYear: number | null;
};

export type JournalCategory = "steuer" | "versicherung" | "kraftstoff" | "sonstiges" | "werkstatt" | "teile" | "fahrt";

export type JournalDraft = {
  /** YYYY-MM-DD */
  date: string;
  category: JournalCategory;
  amountCents: number | null;
  km: number | null;
  note: string;
};
export type JournalEntry = JournalDraft & { id: string };

export type ValuePoint = { at: number; cents: number; source: ValueSource };

export type Vehicle = VehicleDraft & {
  id: string;
  createdAt: number;
  history: ValuePoint[];
  journal: JournalEntry[];
  /** YYYY-MM-DD */
  nextService: string | null;
  monthlyDepreciationCents: number | null;
};

export type Estimate = { lowCents: number; midCents: number; highCents: number };
export type EstimateResult = { estimate: Estimate | null; reason: string | null };

export interface Api {
  listVehicles(): Promise<Vehicle[]>;
  estimateVehicle(draft: VehicleDraft): Promise<EstimateResult>;
  addVehicle(draft: VehicleDraft, valueCents: number, source: ValueSource): Promise<Vehicle>;
  setVehicleValue(id: string, valueCents: number): Promise<Vehicle>;
  deleteVehicle(id: string): Promise<void>;
  addJournalEntry(id: string, entry: JournalDraft): Promise<Vehicle>;
  deleteJournalEntry(id: string, entryId: string): Promise<Vehicle>;
  setNextService(id: string, date: string | null): Promise<Vehicle>;
  listProfiles(): Promise<Profile[]>;
  register(input: RegisterInput): Promise<Profile>;
  login(email: string, password: string): Promise<Profile>;
  logout(): Promise<void>;
  setNickname(nickname: string): Promise<Profile>;
  saveOnboarding(answers: OnboardingAnswers): Promise<Profile>;
}

const tauriApi: Api = {
  listProfiles: () => invoke("list_profiles"),
  register: (input) => invoke("register", { input }),
  login: (email, password) => invoke("login", { email, password }),
  logout: () => invoke("logout"),
  setNickname: (nickname) => invoke("set_nickname", { nickname }),
  saveOnboarding: (answers) => invoke("save_onboarding", { answers }),
  listVehicles: () => invoke("list_vehicles"),
  estimateVehicle: (draft) => invoke("estimate_vehicle", { draft }),
  addVehicle: (draft, valueCents, source) => invoke("add_vehicle", { draft, valueCents, source }),
  setVehicleValue: (id, valueCents) => invoke("set_vehicle_value", { id, valueCents }),
  deleteVehicle: (id) => invoke("delete_vehicle", { id }),
  addJournalEntry: (id, entry) => invoke("add_journal_entry", { id, entry }),
  deleteJournalEntry: (id, entryId) => invoke("delete_journal_entry", { id, entryId }),
  setNextService: (id, date) => invoke("set_next_service", { id, date }),
};

/** Browser-only preview mock. Nothing is persisted. */
function createMockApi(): Api {
  type Row = Profile & { password: string; nickname: string };
  const rows: Row[] = [];
  let session: Row | null = null;
  let vehicles: Vehicle[] = [];
  const now = () => Math.floor(Date.now() / 1000);
  const patch = (id: string, change: (v: Vehicle) => Vehicle): Vehicle => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) throw "Fahrzeug nicht gefunden.";
    const next = change(v);
    vehicles = vehicles.map((x) => (x.id === id ? next : x));
    return next;
  };
  const pub = (r: Row): Profile => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    displayName: r.nickname || r.firstName,
    email: r.email,
    onboardingDone: r.onboardingDone,
  });
  const need = (): Row => {
    if (!session) throw "Nicht angemeldet.";
    return session;
  };
  return {
    async listProfiles() {
      return rows.map(pub);
    },
    async register(input) {
      const email = input.email.trim().toLowerCase();
      if (rows.some((r) => r.email === email)) throw "Für diese E-Mail existiert bereits ein Profil.";
      const row: Row = {
        id: crypto.randomUUID(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        nickname: "",
        displayName: "",
        email,
        onboardingDone: false,
        password: input.password,
      };
      rows.push(row);
      session = row;
      return pub(row);
    },
    async login(email, password) {
      const row = rows.find((r) => r.email === email.trim().toLowerCase());
      if (!row || row.password !== password) throw "E-Mail oder Passwort ist falsch.";
      session = row;
      return pub(row);
    },
    async logout() {
      session = null;
      vehicles = [];
    },
    async setNickname(nickname) {
      const row = need();
      row.nickname = nickname.trim();
      return pub(row);
    },
    async saveOnboarding() {
      const row = need();
      row.onboardingDone = true;
      return pub(row);
    },
    async listVehicles() {
      need();
      return vehicles;
    },
    // Crude stand-in so the screens can be previewed; the real model lives in Rust.
    async estimateVehicle(d) {
      const year = new Date().getFullYear();
      if (d.purchasePriceCents === null || d.purchaseYear === null)
        return { estimate: null, reason: "Für eine Schätzung brauchen wir Kaufpreis und Kaufjahr." };
      if (year - d.buildYear >= 30)
        return { estimate: null, reason: "Für Oldtimer können wir keinen seriösen Wert berechnen. Trage den Wert bitte selbst ein, zum Beispiel aus einem Gutachten." };
      const mid = Math.round((d.purchasePriceCents * 0.88 ** (year - d.purchaseYear)) / 10000) * 10000;
      const round = (x: number) => Math.round(x / 10000) * 10000;
      return { estimate: { lowCents: round(mid * 0.88), midCents: mid, highCents: round(mid * 1.12) }, reason: null };
    },
    async addVehicle(draft, valueCents, source) {
      need();
      const v: Vehicle = {
        ...draft,
        id: crypto.randomUUID(),
        createdAt: now(),
        history: [{ at: now(), cents: valueCents, source }],
        journal: [],
        nextService: null,
        monthlyDepreciationCents: draft.purchasePriceCents ? Math.round(valueCents * 0.008) : null,
      };
      vehicles = [...vehicles, v];
      return v;
    },
    async setVehicleValue(id, valueCents) {
      return patch(id, (v) => ({
        ...v,
        history: [...v.history, { at: now(), cents: valueCents, source: "manual" as const }],
      }));
    },
    async addJournalEntry(id, entry) {
      return patch(id, (v) => ({ ...v, journal: [...v.journal, { ...entry, id: crypto.randomUUID() }] }));
    },
    async deleteJournalEntry(id, entryId) {
      return patch(id, (v) => ({ ...v, journal: v.journal.filter((e) => e.id !== entryId) }));
    },
    async setNextService(id, date) {
      return patch(id, (v) => ({ ...v, nextService: date }));
    },
    async deleteVehicle(id) {
      vehicles = vehicles.filter((x) => x.id !== id);
    },
  };
}

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
/** The mock exists in dev and in the explicit web preview build (`npm run build:preview`), never in the app. */
const previewAllowed = import.meta.env.DEV || __PREVIEW__;

export const isPreviewMock = previewAllowed && !inTauri;
export const api: Api = previewAllowed && !inTauri ? createMockApi() : tauriApi;

/** Normalises whatever a failed command rejects with into a display string. */
export function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}
