/**
 * Single gateway between the UI and the Rust backend.
 *
 * All secrets (passwords, hashes) are handled in Rust only. The UI passes a
 * password once per call and never stores it.
 *
 * Outside of Tauri (plain `vite dev` in a browser) a volatile in-memory mock
 * is used so screens can be reviewed. The mock is compiled out of production
 * builds.
 */
import { invoke } from "@tauri-apps/api/core";

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

export interface Api {
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
};

/** Browser-only preview mock. Nothing is persisted. */
function createMockApi(): Api {
  type Row = Profile & { password: string; nickname: string };
  const rows: Row[] = [];
  let session: Row | null = null;
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
  };
}

const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isPreviewMock = !inTauri && import.meta.env.DEV;
export const api: Api = inTauri || !import.meta.env.DEV ? tauriApi : createMockApi();

/** Normalises whatever a failed command rejects with into a display string. */
export function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  return "Etwas ist schiefgelaufen. Bitte versuche es erneut.";
}
