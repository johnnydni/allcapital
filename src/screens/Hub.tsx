import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { Wordmark } from "../components/Logo";

/** "welcome to hub" frame. */
export function HubWelcome(p: { onDemo: () => void; onStart: () => void; onLock: () => void }) {
  return (
    <section className="screen">
      <Wordmark />
      <div className="top-actions">
        <button className="top-actions__user" onClick={p.onLock} aria-label="Sperren" title="Sperren">
          <Icon name="user" />
        </button>
        <button disabled aria-label="Einstellungen" title="Noch nicht verfügbar">
          <Icon name="gear" />
        </button>
      </div>
      <div className="welcome">
        <h1>
          Willkommen bei
          <br />
          All Capital.
        </h1>
        <div className="welcome__cols">
          <div>
            <p>Klicke hier, um zu einem Demo Hub zu gelangen. Mach dir ein Bild.</p>
            <button className="cta cta--hub" onClick={p.onDemo}>
              <Icon name="hub" />
              HUB
            </button>
          </div>
          <div>
            <p>Klicke hier, um eine Einführung zu All Capital zu erhalten.</p>
            <button className="cta cta--tutorial" disabled title="Noch nicht verfügbar">
              <Icon name="tutorial" />
              Tutorial
            </button>
          </div>
          <div>
            <p>Klicke hier, um zu deinem vordefinierten Hub zu gelangen und die Reise zu starten.</p>
            <button className="cta cta--start" onClick={p.onStart}>
              <Icon name="play" />
              Start
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

type Mode = "value" | "flow";
type Tile = { title: string; icon: string };

const TILES: Record<Mode, Tile[]> = {
  value: [
    { title: "Immobilie", icon: "property" },
    { title: "Mobilität", icon: "mobility" },
    { title: "Tech", icon: "tech" },
    { title: "Wertsachen", icon: "valuables" },
  ],
  flow: [
    { title: "Banking", icon: "bank" },
    { title: "Depot", icon: "stocks" },
    { title: "Krypto", icon: "crypto" },
    { title: "Depot 2", icon: "stocks" },
  ],
};

const stampFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function useNow(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return stampFormat.format(now).replace(", ", " - ");
}

/** "Empty Hub VALUE" / "Empty Hub FLOW" frames. Tiles are not wired to data yet. */
export function Hub(p: { name: string; demo: boolean; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("value");
  const stamp = useNow();
  const tiles = TILES[mode];
  const add = { disabled: true, title: "Noch nicht verfügbar" } as const;
  return (
    <section className="screen">
      <Wordmark sub={p.demo ? "Demo Hub." : "Willkommen im Hub."} />
      <button
        className={`mode mode--${mode}`}
        role="switch"
        aria-checked={mode === "flow"}
        aria-label="Zwischen Value und Flow wechseln"
        onClick={() => setMode(mode === "value" ? "flow" : "value")}
      >
        <span className="mode__label">{mode.toUpperCase()}</span>
        <span className="mode__track">
          <i />
        </span>
      </button>
      <div className="top-actions">
        <button disabled aria-label="Einstellungen" title="Noch nicht verfügbar">
          <Icon name="gear" />
        </button>
      </div>
      <button className="hub__back" onClick={p.onBack} aria-label="Zurück">
        <Icon name="chevronLeft" />
      </button>

      <div className="hub" key={mode}>
        {tiles.map((t, i) => (
          <button key={t.title} className={`card card--cat card--c${i}`} {...add}>
            <span className="card__title">{t.title}</span>
            <Icon name={t.icon} className="card__icon" />
            <Icon name="plus" className="card__plus" />
          </button>
        ))}
        {mode === "value" ? (
          <>
            <button className="card card--add card--top" {...add} aria-label="Hinzufügen">
              <Icon name="plus" />
            </button>
            <button className="card card--add card--tall" {...add} aria-label="Hinzufügen">
              <Icon name="plus" />
            </button>
          </>
        ) : (
          <div className="card book">
            <div className="book__strip" />
            <h3>
              Persönliches
              <br />
              Finanzbuch
            </h3>
            <div className="book__name">
              <span>{p.name}</span>
              <Icon name="lock" />
            </div>
            <Icon name="book" className="book__icon" />
          </div>
        )}
        <button className="card card--add card--bl" {...add} aria-label="Hinzufügen">
          <Icon name="plus" />
        </button>
        {["s1", "s2", "s3", "s4"].map((k) => (
          <button key={k} className={`card card--add card--sm card--${k}`} {...add} aria-label="Hinzufügen">
            <Icon name={mode === "flow" && k === "s3" ? "shield" : "plus"} />
          </button>
        ))}
        <aside className="card summary">
          <div className="summary__head">
            <strong>Privatvermögen</strong>
            <time>{stamp}</time>
            <b>Gesamt</b>
          </div>
          <div className="summary__row">Sachanlagen</div>
          <div className="summary__row">Cashflow</div>
        </aside>
      </div>
    </section>
  );
}
