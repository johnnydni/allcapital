import { useState } from "react";
import {
  api,
  errorMessage,
  type AssetKind,
  type Goal,
  type Hobby,
  type Knowledge,
  type OnboardingAnswers,
  type Position,
  type Profile,
} from "../lib/api";
import { Icon } from "../components/Icon";
import { PrototypeHeader } from "../components/Logo";

type Option = { id: string; label: string; icon?: string; bullets?: string[] };
type Step = {
  id: "position" | "assets" | "hobbies" | "goals" | "knowledge" | "improve";
  question: string;
  multi: boolean;
  selectAll?: boolean;
  variant: "strip" | "fill" | "level" | "yesno";
  options: Option[];
};

const STEPS: Step[] = [
  {
    id: "position",
    question: "In welcher Position bist du?",
    multi: false,
    variant: "strip",
    options: [
      { id: "schueler", label: "Schüler", icon: "pupil" },
      { id: "student", label: "Student", icon: "student" },
      { id: "berufstaetig", label: "Berufstätig", icon: "worker" },
      { id: "ruhestand", label: "Im Ruhestand", icon: "retired" },
    ],
  },
  {
    id: "assets",
    question: "Welche dieser Elemente treffen auf dich zu?",
    multi: true,
    selectAll: true,
    variant: "strip",
    options: [
      { id: "bank", label: "Bank-/ Sparkonto", icon: "bank" },
      { id: "aktien", label: "Aktien", icon: "stocks" },
      { id: "krypto", label: "Krypto", icon: "crypto" },
      { id: "versicherung", label: "Versicherung", icon: "shield" },
      { id: "eigentum", label: "Eigentum", icon: "property" },
      { id: "mobilitaet", label: "Mobilität", icon: "mobility" },
      { id: "tech", label: "Tech", icon: "tech" },
      {
        id: "wertgegenstaende",
        label: "Wertgegenstände",
        icon: "valuables",
        bullets: ["Edelmetalle", "Briefmarken", "Münzen", "Collectors Items"],
      },
    ],
  },
  {
    id: "hobbies",
    question: "Welche Hobbies hast du?",
    multi: true,
    selectAll: true,
    variant: "strip",
    options: [
      { id: "gaming", label: "Gaming", icon: "gaming" },
      { id: "filme", label: "Filme/Serien", icon: "movies" },
      { id: "sport", label: "Sport", icon: "sport" },
      { id: "reisen", label: "Reisen", icon: "travel" },
      { id: "kochen", label: "Kochen", icon: "cooking" },
      { id: "schrauben", label: "Schrauben", icon: "wrench" },
      { id: "fotografie", label: "Fotografie", icon: "photo" },
      { id: "andere", label: "Andere coole Sachen wie:", icon: "other", bullets: ["Finanzen", "Politik", "Business"] },
    ],
  },
  {
    id: "goals",
    question: "Was möchtest du mit Hilfe von All Capital erreichen?",
    multi: true,
    variant: "fill",
    options: [
      { id: "ueberblick", label: "Überblick über Vermögen", icon: "overview" },
      { id: "verwalten", label: "Finanzen verwalten", icon: "manage" },
      { id: "umgang", label: "Besser mit Geld umgehen", icon: "better" },
    ],
  },
  {
    id: "knowledge",
    question: "Wie würdest du deine Kenntnisse über Finanzen einschätzen?",
    multi: false,
    variant: "level",
    options: [
      { id: "neuling", label: "Neuling" },
      { id: "basics", label: "Basics" },
      { id: "erfahren", label: "Erfahren" },
      { id: "profi", label: "Profi" },
    ],
  },
  {
    id: "improve",
    question: "Möchtest du diese Kenntnisse verbessern?",
    multi: false,
    variant: "yesno",
    options: [
      { id: "ja", label: "Ja." },
      { id: "nein", label: "Nein." },
    ],
  },
];

type Selections = Record<Step["id"], string[]>;
const EMPTY: Selections = { position: [], assets: [], hobbies: [], goals: [], knowledge: [], improve: [] };

/** Frames 14–29, 35, 84. */
export function Onboarding(p: { profile: Profile; onDone: (profile: Profile) => void; onEditNickname: () => void }) {
  const [index, setIndex] = useState(0);
  const [sel, setSel] = useState<Selections>(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const step = STEPS[index]!;
  const chosen = sel[step.id];
  const answered = chosen.length > 0;
  const last = index === STEPS.length - 1;
  const progress = Math.max(0.1, (index + (answered ? 1 : 0)) / STEPS.length);

  function toggle(id: string) {
    setSel((s) => {
      const cur = s[step.id];
      const next = step.multi ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id];
      return { ...s, [step.id]: next };
    });
  }

  function toggleAll() {
    setSel((s) => ({
      ...s,
      [step.id]: s[step.id].length === step.options.length ? [] : step.options.map((o) => o.id),
    }));
  }

  async function next() {
    if (!answered || busy) return;
    if (!last) {
      setIndex(index + 1);
      return;
    }
    const answers: OnboardingAnswers = {
      position: sel.position[0] as Position,
      assets: sel.assets as AssetKind[],
      hobbies: sel.hobbies as Hobby[],
      goals: sel.goals as Goal[],
      knowledge: sel.knowledge[0] as Knowledge,
      improve: sel.improve[0] === "ja",
    };
    setBusy(true);
    try {
      p.onDone(await api.saveOnboarding(answers));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <PrototypeHeader />
      <div className="ob__left">
        <h1>
          Willkommen,
          <br />
          {p.profile.displayName}.
        </h1>
        <button className="chip ob__nick" onClick={p.onEditNickname}>
          Spitznamen ändern
        </button>
        <p>Lass uns ein paar Fragen beantworten, damit All Capital dir einen optimalen Einstieg bereitet.</p>
        <div
          className={`progress ${progress >= 1 ? "is-full" : ""}`}
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <div className="divider" />
      <div className="ob__right" key={step.id}>
        <h2>{step.question}</h2>
        <div className={`tiles tiles--${step.variant} tiles--n${Math.min(step.options.length, 4)}`}>
          {step.options.map((o) => (
            <button
              key={o.id}
              className={`tile-opt tile-opt--${o.id} ${chosen.includes(o.id) ? "is-on" : ""}`}
              aria-pressed={chosen.includes(o.id)}
              onClick={() => toggle(o.id)}
            >
              <span className="tile-opt__box">{o.icon && <Icon name={o.icon} />}</span>
              <span className="tile-opt__label">
                {o.label}
                {o.bullets && (
                  <ul>
                    {o.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="ob__actions">
          {step.selectAll ? (
            <button className="chip chip--lg" onClick={toggleAll}>
              Alle auswählen
            </button>
          ) : (
            <span />
          )}
          {index > 0 && (
            <button className="chip chip--lg" onClick={() => setIndex(index - 1)}>
              Zurück
            </button>
          )}
          <button className={`btn btn--sm ob__next ${answered ? "is-in" : ""}`} onClick={next} disabled={!answered || busy}>
            {last ? "Fertig" : "Weiter"}
          </button>
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
      </div>
    </section>
  );
}
