import { useState, type FormEvent } from "react";
import { api, errorMessage, type Vehicle } from "../lib/api";
import { formatCents, parseMoney } from "../lib/money";
import { currentValue, serviceText, valueChange } from "../lib/vehicles";
import carIcon from "../assets/car-icon.png";
import close from "../assets/close.png";
import edit from "../assets/edit.png";
import help from "../assets/help.png";
import journal from "../assets/journal.png";
import car from "../assets/kind-car.png";
import leaf from "../assets/leaf.png";
import plus from "../assets/plus.png";

const TOOLS = [
  { id: "journal", label: "Auto-Tagebuch", img: journal },
  { id: "tool", label: "Neues Tool", img: plus },
  { id: "expense", label: "", img: plus },
  { id: "sell", label: "Fahrzeug verkaufen", img: carIcon },
  { id: "eco", label: "Nachhaltigkeit", img: leaf },
];

const CHART = { x0: 0, x1: 184, y0: 6, y1: 196 };

/** Maps the value history onto the chart box. One point becomes a flat line. */
function chartPoints(v: Vehicle): [number, number][] {
  const values = v.history.map((h) => h.cents);
  const series = values.length === 1 ? [values[0]!, values[0]!] : values;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series.map((cents, i) => [
    CHART.x0 + ((CHART.x1 - CHART.x0) * i) / (series.length - 1),
    max === min ? (CHART.y0 + CHART.y1) / 2 : CHART.y1 - ((cents - min) / span) * (CHART.y1 - CHART.y0),
  ]);
}

/** Figma frame "Mobilität Preview Overlay": one vehicle with its value history. */
export function VehicleAsset(p: {
  vehicles: Vehicle[];
  id: string;
  onSelect: (id: string) => void;
  onChanged: (vehicle: Vehicle) => void;
  onDeleted: (id: string) => void;
  onOpenJournal: () => void;
  onClose: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const index = Math.max(0, p.vehicles.findIndex((v) => v.id === p.id));
  const vehicle = p.vehicles[index];
  if (!vehicle) return null;

  const value = currentValue(vehicle);
  const change = valueChange(vehicle);
  const down = change !== null && change < 0;
  const tone = down ? "down" : "up";
  const points = chartPoints(vehicle);
  const last = points[points.length - 1]!;
  const hoverLabel = TOOLS.find((t) => t.id === hover)?.label;

  async function saveValue(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoney(input);
    if (cents === null) return setError("Bitte gib einen gültigen Wert ein.");
    try {
      p.onChanged(await api.setVehicleValue(vehicle!.id, cents));
      setEditing(false);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await api.deleteVehicle(vehicle!.id);
      p.onDeleted(vehicle!.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="va">
      <div className="va__bar" onMouseLeave={() => setHover(null)}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`va__tool va__tool--${t.id}`}
            aria-disabled={t.id !== "journal"}
            aria-label={t.label || "Weitere Aktion"}
            title={t.id === "journal" ? undefined : "Noch nicht verfügbar"}
            onClick={t.id === "journal" ? p.onOpenJournal : undefined}
            onMouseEnter={() => setHover(t.id)}
            onFocus={() => setHover(t.id)}
            onBlur={() => setHover(null)}
          >
            <img src={t.img} alt="" />
          </button>
        ))}
        {hoverLabel ? <span className="va__barlabel">{hoverLabel}</span> : <img className="va__help" src={help} alt="" />}
      </div>

      <button className="va__close" onClick={p.onClose} aria-label="Schließen">
        <img src={close} alt="" />
      </button>
      <div className="va__pro" title="Noch nicht verfügbar">
        <img src={plus} alt="" />
        <span>PRO</span>
      </div>

      <div className="va__card" />
      <h2 className="va__title">Mobilität</h2>
      {change !== null && (
        <p className={`va__change va__change--${tone}`}>
          <i />
          {new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
            Math.abs(change) * 100,
          )}
          %
        </p>
      )}
      <img className="va__caricon" src={carIcon} alt="" />
      {editing ? (
        <form className="va__valueform" onSubmit={saveValue}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            inputMode="decimal"
            maxLength={16}
            autoFocus
            aria-label="Neuer Wert"
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          />
          <button>OK</button>
        </form>
      ) : (
        <p className="va__value">{formatCents(value)}</p>
      )}

      <svg className={`va__chart va__chart--${tone}`} viewBox="-8 0 204 204" aria-hidden="true">
        <path className="va__axis" d="M0 0V200H202" />
        <path className="va__marker" d={`M${last[0]} 0V200`} />
        <polyline points={points.map((pt) => pt.join(",")).join(" ")} />
        <circle cx={last[0]} cy={last[1]} r="10" />
      </svg>
      <p className={`va__chartlabel va__change--${tone}`}>{formatCents(value)}</p>

      {vehicle.monthlyDepreciationCents !== null && vehicle.monthlyDepreciationCents > 0 && (
        <>
          <p className="va__deplabel">Abschreibung</p>
          <p className="va__dep" title="Modellierter Wertverlust im kommenden Monat">
            - {formatCents(vehicle.monthlyDepreciationCents)}
          </p>
        </>
      )}

      {vehicle.nextService && (
        <p className="va__service">
          <b>Werkstatt-besuch {serviceText(vehicle.nextService).startsWith("über") ? "" : "in"}</b>
          {serviceText(vehicle.nextService)}
        </p>
      )}

      <p className="form-error va__error" role="alert">
        {error}
      </p>
      <button className="va__delete" onClick={remove} onBlur={() => setConfirmDelete(false)}>
        {confirmDelete ? "Wirklich entfernen? Nochmal klicken." : "Fahrzeug entfernen"}
      </button>

      <div className="va__photo">
        <img src={car} alt="" />
      </div>
      <div className="va__label">
        <strong>
          {vehicle.brand} {vehicle.model}
          <br />
          {vehicle.buildYear}
        </strong>
        <span>
          {vehicle.powerPs !== null && <>{vehicle.powerPs} PS</>}
          <br />
          {vehicle.mileageKm !== null && <>{new Intl.NumberFormat("de-DE").format(vehicle.mileageKm)}km</>}
        </span>
        <button
          onClick={() => {
            setInput(formatCents(value));
            setEditing(true);
          }}
          aria-label="Wert ändern"
          title="Wert ändern"
        >
          <img src={edit} alt="" />
        </button>
      </div>
      {p.vehicles.length > 1 && (
        <div className="va__pager">
          <button onClick={() => p.onSelect(p.vehicles[(index - 1 + p.vehicles.length) % p.vehicles.length]!.id)} aria-label="Vorheriges Fahrzeug">
            ‹
          </button>
          {index + 1} / {p.vehicles.length}
          <button onClick={() => p.onSelect(p.vehicles[(index + 1) % p.vehicles.length]!.id)} aria-label="Nächstes Fahrzeug">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
