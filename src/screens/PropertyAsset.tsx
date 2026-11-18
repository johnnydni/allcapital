import { useState, type FormEvent } from "react";
import { api, errorMessage, type Property } from "../lib/api";
import { formatCents, parseMoney } from "../lib/money";
import { PROPERTY_KIND_LABEL, renovationText } from "../lib/properties";
import { currentValue, valueChange } from "../lib/vehicles";
import { AssetChrome, AssetToolbar, ChangeBadge, ValueChart } from "../components/AssetParts";
import edit from "../assets/edit.png";
import houseIcon from "../assets/house-icon.png";
import leaf from "../assets/leaf.png";
import commercial from "../assets/prop-commercial.png";
import flat from "../assets/prop-flat.png";
import garage from "../assets/prop-garage.png";
import house from "../assets/prop-house.png";
import transaction from "../assets/transaction.png";

const PICTURE = { haus: house, wohnung: flat, garage, gewerbe: commercial };
const num = new Intl.NumberFormat("de-DE");
const pct = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });

/** Figma frame "Immobilien Preview Overlay". */
export function PropertyAsset(p: {
  properties: Property[];
  id: string;
  onSelect: (id: string) => void;
  onChanged: (property: Property) => void;
  onDeleted: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const index = Math.max(0, p.properties.findIndex((x) => x.id === p.id));
  const property = p.properties[index];
  if (!property) return null;

  const value = currentValue(property);
  const change = valueChange(property);
  const facts: [string, string][] = [
    ["Baujahr", property.buildYear ? String(property.buildYear) : ""],
    ["Zimmer", property.rooms ? num.format(property.rooms) : ""],
    ["Badezimmer", property.bathrooms ? String(property.bathrooms) : ""],
    ["Grundfläche", property.plotAreaM2 ? `${num.format(property.plotAreaM2)} m²` : ""],
    ["Wohnfläche", property.livingAreaM2 ? `${num.format(property.livingAreaM2)} m²` : ""],
  ];
  const shownFacts = facts.filter(([, v]) => v);

  async function saveValue(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoney(input);
    if (cents === null) return setError("Bitte gib einen gültigen Wert ein.");
    try {
      p.onChanged(await api.setPropertyValue(property!.id, cents));
      setEditing(false);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await api.deleteProperty(property!.id);
      p.onDeleted(property!.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="va">
      <AssetToolbar
        tools={[
          { id: "new", label: "Immobilie hinzufügen", color: "#ebebeb", onClick: p.onAdd },
          { id: "expense", label: "", color: "#ee8d8d" },
          { id: "sell", label: "Immobilie verkaufen", color: "#c5fcc7", img: houseIcon },
          { id: "transactions", label: "Transaktionen", color: "#eef4a6", img: transaction },
          { id: "eco", label: "Nachhaltigkeit", color: "none", img: leaf },
        ]}
      />
      <AssetChrome onClose={p.onClose} />

      <h2 className="va__title">Immobilie</h2>
      <ChangeBadge change={change} />
      <img className="va__caricon pa__icon" src={houseIcon} alt="" />
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
      <ValueChart values={property.history.map((h) => h.cents)} down={change !== null && change < 0} />

      {property.yearlyAfaCents !== null && property.afaRateBp !== null && (
        <>
          <p className="va__deplabel">Abschreibung</p>
          <p className="va__dep">- {formatCents(property.yearlyAfaCents)}</p>
          <p className="pa__afanote">
            pro Jahr · lineare AfA {pct.format(property.afaRateBp / 100)} % · steuerlich, kein Marktwertverlust
          </p>
        </>
      )}
      {property.nextRenovationYear !== null && (
        <p className="pa__renovation">
          Renovierung {renovationText(property.nextRenovationYear).startsWith("in") ? "in" : ""}
          <b>{renovationText(property.nextRenovationYear).replace(/^in /, "")}</b>
          <small>Pflichten nach dem Gebäudeenergiegesetz (GEG) prüfen</small>
        </p>
      )}

      <p className="form-error va__error" role="alert">
        {error}
      </p>
      <button className="va__delete" onClick={remove} onBlur={() => setConfirmDelete(false)}>
        {confirmDelete ? "Wirklich entfernen? Nochmal klicken." : "Immobilie entfernen"}
      </button>

      <div className="va__photo pa__photo">
        <img src={PICTURE[property.kind]} alt="" />
      </div>
      {shownFacts.length > 0 && (
        <dl className="pa__facts">
          <dt className="pa__factstitle">Eckdaten</dt>
          {shownFacts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}:</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="va__label pa__label">
        <strong>{property.name}</strong>
        <span>
          {property.street && (
            <>
              {property.street}
              <br />
            </>
          )}
          {property.state && (
            <>
              {property.state}
              <br />
            </>
          )}
          {[property.postalCode, property.city].filter(Boolean).join(" ") || PROPERTY_KIND_LABEL[property.kind]}
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
      {p.properties.length > 1 && (
        <div className="va__pager">
          <button
            onClick={() => p.onSelect(p.properties[(index - 1 + p.properties.length) % p.properties.length]!.id)}
            aria-label="Vorherige Immobilie"
          >
            ‹
          </button>
          {index + 1} / {p.properties.length}
          <button onClick={() => p.onSelect(p.properties[(index + 1) % p.properties.length]!.id)} aria-label="Nächste Immobilie">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
