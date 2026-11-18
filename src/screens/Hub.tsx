import { useEffect, useState } from "react";
import { api, type Device, type Property, type Vehicle } from "../lib/api";
import { formatCents } from "../lib/money";
import { totalValue } from "../lib/vehicles";
import { Icon } from "../components/Icon";
import { Wordmark } from "../components/Logo";
import { VehicleAsset } from "./VehicleAsset";
import { VehicleJournal } from "./VehicleJournal";
import { PropertyAsset } from "./PropertyAsset";
import { PropertyWizard } from "./PropertyWizard";
import { TechAsset } from "./TechAsset";
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

type Sub =
  | { view: "grid" }
  | { view: "wizard" | "property-wizard" }
  | { view: "asset" | "journal" | "property"; id: string }
  | { view: "tech"; adding: boolean };

type Category = { label: string; total: number; open?: () => void; add: () => void; tip: string };

/** Hub with the VALUE / FLOW grids and the asset screens behind the tiles. */
export function Hub(p: { name: string; demo: boolean; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("value");
  const [sub, setSub] = useState<Sub>({ view: "grid" });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const stamp = useNow();

  useEffect(() => {
    if (p.demo) return;
    let alive = true;
    Promise.all([api.listVehicles(), api.listProperties(), api.listDevices()])
      .then(([v, pr, d]) => {
        if (!alive) return;
        setVehicles(v);
        setProperties(pr);
        setDevices(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [p.demo]);

  const tiles = TILES[mode];
  const total = totalValue(vehicles) + totalValue(properties) + totalValue(devices);
  const replace = <T extends { id: string }>(item: T) => (list: T[]) => list.map((x) => (x.id === item.id ? item : x));
  const categories: Record<string, Category> = {
    Immobilie: {
      label: "Immobilien anzeigen",
      total: totalValue(properties),
      open: properties[0] && (() => setSub({ view: "property", id: properties[0]!.id })),
      add: () => setSub({ view: "property-wizard" }),
      tip: "Neue Immobilie hinzufügen",
    },
    Mobilität: {
      label: "Fahrzeuge anzeigen",
      total: totalValue(vehicles),
      open: vehicles[0] && (() => setSub({ view: "asset", id: vehicles[0]!.id })),
      add: () => setSub({ view: "wizard" }),
      tip: "Neues Fahrzeug hinzufügen",
    },
    Tech: {
      label: "Geräte anzeigen",
      total: totalValue(devices),
      open: devices[0] && (() => setSub({ view: "tech", adding: false })),
      add: () => setSub({ view: "tech", adding: true }),
      tip: "Neues Gerät hinzufügen",
    },
  };
  const add = { disabled: true, title: "Noch nicht verfügbar" } as const;
  const grid = { view: "grid" } as const;
  const update = (v: Vehicle) => setVehicles(replace(v));
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

      {sub.view === "property-wizard" && (
        <PropertyWizard
          onExit={() => setSub(grid)}
          onDone={(pr) => {
            setProperties((list) => [...list, pr]);
            setSub({ view: "property", id: pr.id });
          }}
        />
      )}

      {sub.view === "property" && (
        <PropertyAsset
          properties={properties}
          id={sub.id}
          onSelect={(id) => setSub({ view: "property", id })}
          onClose={() => setSub(grid)}
          onAdd={() => setSub({ view: "property-wizard" })}
          onChanged={(pr) => setProperties(replace(pr))}
          onDeleted={(id) => {
            setProperties((list) => list.filter((x) => x.id !== id));
            setSub(grid);
          }}
        />
      )}

      {sub.view === "tech" && (
        <TechAsset
          devices={devices}
          startAdding={sub.adding}
          onClose={() => setSub(grid)}
          onAdded={(d) => setDevices((list) => [...list, d])}
          onChanged={(d) => setDevices(replace(d))}
          onDeleted={(id) => setDevices((list) => list.filter((x) => x.id !== id))}
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
              const c = mode === "value" && !p.demo ? categories[t.title] : undefined;
              const owned = !!c?.open;
              return (
                <div key={t.title} className={`card card--cat card--c${i}`}>
                  <span className="card__title">{t.title}</span>
                  <Icon name={t.icon} className="card__icon" />
                  {c?.open && (
                    <button className="card__open" onClick={c.open} aria-label={c.label}>
                      {formatCents(c.total)}
                    </button>
                  )}
                  <button
                    className={`card__add ${owned ? "card__add--corner" : ""}`}
                    disabled={!c}
                    onClick={c?.add}
                    aria-label={c ? c.tip : "Hinzufügen"}
                    title={c ? undefined : "Noch nicht verfügbar"}
                  >
                    <Icon name="plus" />
                    {c && <span className="card__tip">{c.tip}</span>}
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
