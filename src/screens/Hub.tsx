import { useEffect, useState } from "react";
import { api, type Vehicle } from "../lib/api";
import { formatCents } from "../lib/money";
import { totalValue } from "../lib/vehicles";
import { Icon } from "../components/Icon";
import { Wordmark } from "../components/Logo";
import { VehicleAsset } from "./VehicleAsset";
import { VehicleJournal } from "./VehicleJournal";
import { VehicleWizard } from "./VehicleWizard";
import logoMark from "../assets/logo-mark.png";
import settings from "../assets/settings.png";

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

type Sub = { view: "grid" } | { view: "wizard" } | { view: "asset" | "journal"; id: string };

/** Hub with the VALUE / FLOW grids, the vehicle wizard and the vehicle asset screen. */
export function Hub(p: { name: string; demo: boolean; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("value");
  const [sub, setSub] = useState<Sub>({ view: "grid" });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const stamp = useNow();

  useEffect(() => {
    if (p.demo) return;
    let alive = true;
    api
      .listVehicles()
      .then((list) => alive && setVehicles(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [p.demo]);

  const tiles = TILES[mode];
  const total = totalValue(vehicles);
  const add = { disabled: true, title: "Noch nicht verfügbar" } as const;
  const grid = { view: "grid" } as const;
  const update = (v: Vehicle) => setVehicles((list) => list.map((x) => (x.id === v.id ? v : x)));
  const journalVehicle = sub.view === "journal" ? vehicles.find((x) => x.id === sub.id) : undefined;

  return (
    <section className="screen">
      <img className="hh__logo" src={logoMark} alt="" />
      <p className="hh__title">All Capital.</p>
      <p className="hh__sub">{p.demo ? "Demo Hub." : "Willkommen im Hub."}</p>
      <button className="hh__gear" disabled aria-label="Einstellungen" title="Noch nicht verfügbar">
        <img src={settings} alt="" />
      </button>

      {sub.view === "wizard" && (
        <VehicleWizard
          onExit={() => setSub(grid)}
          onDone={(v) => {
            setVehicles((list) => [...list, v]);
            setSub({ view: "asset", id: v.id });
          }}
        />
      )}

      {sub.view === "asset" && (
        <VehicleAsset
          vehicles={vehicles}
          id={sub.id}
          onSelect={(id) => setSub({ view: "asset", id })}
          onClose={() => setSub(grid)}
          onOpenJournal={() => setSub({ view: "journal", id: sub.id })}
          onChanged={update}
          onDeleted={(id) => {
            setVehicles((list) => list.filter((x) => x.id !== id));
            setSub(grid);
          }}
        />
      )}

      {sub.view === "journal" && journalVehicle && (
        <VehicleJournal
          vehicle={journalVehicle}
          onChanged={update}
          onBack={() => setSub({ view: "asset", id: sub.id })}
          onClose={() => setSub(grid)}
        />
      )}

      {sub.view === "grid" && (
        <>
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
          <button className="hub__back" onClick={p.onBack} aria-label="Zurück">
            <Icon name="chevronLeft" />
          </button>

          <div className="hub" key={mode}>
            {tiles.map((t, i) => {
              const mobility = mode === "value" && t.title === "Mobilität" && !p.demo;
              const owned = mobility && vehicles.length > 0;
              return (
                <div key={t.title} className={`card card--cat card--c${i}`}>
                  <span className="card__title">{t.title}</span>
                  <Icon name={t.icon} className="card__icon" />
                  {owned && (
                    <button
                      className="card__open"
                      onClick={() => setSub({ view: "asset", id: vehicles[0]!.id })}
                      aria-label="Fahrzeuge anzeigen"
                    >
                      {formatCents(total)}
                    </button>
                  )}
                  <button
                    className={`card__add ${owned ? "card__add--corner" : ""}`}
                    disabled={!mobility}
                    onClick={() => setSub({ view: "wizard" })}
                    aria-label={mobility ? "Neues Fahrzeug hinzufügen" : "Hinzufügen"}
                    title={mobility ? undefined : "Noch nicht verfügbar"}
                  >
                    <Icon name="plus" />
                    {mobility && <span className="card__tip">Neues Fahrzeug hinzufügen</span>}
                  </button>
                </div>
              );
            })}
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
                {total > 0 && <span>{formatCents(total)}</span>}
              </div>
              <div className="summary__row">
                Sachanlagen
                {total > 0 && <span>{formatCents(total)}</span>}
              </div>
              <div className="summary__row">Cashflow</div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
