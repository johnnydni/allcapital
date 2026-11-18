import { useState, type FormEvent } from "react";
import { api, errorMessage, type Vehicle } from "../lib/api";
import { formatCents, parseMoney } from "../lib/money";
import { currentValue, serviceText, valueChange } from "../lib/vehicles";
import { AssetChrome, AssetToolbar, ChangeBadge, ValueChart } from "../components/AssetParts";
import carIcon from "../assets/car-icon.png";
import edit from "../assets/edit.png";
import journal from "../assets/journal.png";
import car from "../assets/kind-car.png";
import leaf from "../assets/leaf.png";

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
      <AssetToolbar
        tools={[
          { id: "journal", label: "Auto-Tagebuch", color: "#ebebeb", img: journal, onClick: p.onOpenJournal },
          { id: "tool", label: "Neues Tool", color: "#8dc6ef" },
          { id: "expense", label: "", color: "#ee8d8d" },
          { id: "sell", label: "Fahrzeug verkaufen", color: "#c5fcc7", img: carIcon },
          { id: "eco", label: "Nachhaltigkeit", color: "none", img: leaf },
        ]}
      />
      <AssetChrome onClose={p.onClose} />
      <h2 className="va__title">Mobilität</h2>
      <ChangeBadge change={change} />
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

      <ValueChart values={vehicle.history.map((h) => h.cents)} down={down} />

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
