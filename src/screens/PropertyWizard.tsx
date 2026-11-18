import { useState, type FormEvent } from "react";
import { api, errorMessage, type Property, type PropertyDraft, type PropertyKind } from "../lib/api";
import { formatWhole, parseInteger, parseMoney } from "../lib/money";
import { PROPERTY_KIND_LABEL, STATES } from "../lib/properties";
import back from "../assets/back.png";
import edit from "../assets/edit.png";
import houseIcon from "../assets/house-icon.png";
import commercial from "../assets/prop-commercial.png";
import flat from "../assets/prop-flat.png";
import garage from "../assets/prop-garage.png";
import house from "../assets/prop-house.png";

type Form = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  state: string;
  buildYear: string;
  livingArea: string;
  plotArea: string;
  rooms: string;
  bathrooms: string;
  purchasePrice: string;
  purchaseYear: string;
  rented: boolean;
  buildingShare: string;
  nextRenovation: string;
};

const EMPTY: Form = {
  name: "",
  street: "",
  postalCode: "",
  city: "",
  state: "",
  buildYear: "",
  livingArea: "",
  plotArea: "",
  rooms: "",
  bathrooms: "",
  purchasePrice: "",
  purchaseYear: "",
  rented: false,
  buildingShare: "",
  nextRenovation: "",
};

const optInt = (v: string) => (v.trim() ? parseInteger(v) : null);

function toDraft(kind: PropertyKind, f: Form): PropertyDraft | string {
  const year = new Date().getFullYear();
  if (!f.name.trim()) return "Bitte gib der Immobilie einen Namen.";
  const ints = { buildYear: optInt(f.buildYear), living: optInt(f.livingArea), plot: optInt(f.plotArea), baths: optInt(f.bathrooms) };
  if (f.buildYear.trim() && (ints.buildYear === null || ints.buildYear < 1000 || ints.buildYear > year + 5))
    return "Das Baujahr ist ungültig.";
  if ((f.livingArea.trim() && !ints.living) || (f.plotArea.trim() && !ints.plot)) return "Die Fläche ist ungültig.";
  if (f.bathrooms.trim() && ints.baths === null) return "Die Anzahl der Badezimmer ist ungültig.";
  const rooms = f.rooms.trim() ? Number(f.rooms.replace(",", ".")) : null;
  if (rooms !== null && (!(rooms > 0) || (rooms * 2) % 1 !== 0)) return "Die Zimmerzahl ist ungültig (ganze oder halbe Zimmer).";
  if (!!f.purchasePrice.trim() !== !!f.purchaseYear.trim()) return "Bitte gib Kaufpreis und Kaufjahr zusammen an.";
  const price = f.purchasePrice.trim() ? parseMoney(f.purchasePrice) : null;
  if (f.purchasePrice.trim() && !price) return "Der Kaufpreis ist ungültig.";
  const purchaseYear = optInt(f.purchaseYear);
  if (f.purchaseYear.trim() && (purchaseYear === null || purchaseYear < 1900 || purchaseYear > year))
    return "Das Kaufjahr ist ungültig.";
  const share = f.rented && f.buildingShare.trim() ? optInt(f.buildingShare) : null;
  if (f.rented && f.buildingShare.trim() && (!share || share > 100)) return "Der Gebäudeanteil muss zwischen 1 und 100 % liegen.";
  const renovation = optInt(f.nextRenovation);
  if (f.nextRenovation.trim() && (renovation === null || renovation < year || renovation > year + 100))
    return "Das Jahr der nächsten Renovierung ist ungültig.";
  return {
    kind,
    name: f.name,
    street: f.street,
    postalCode: f.postalCode,
    city: f.city,
    state: f.state,
    buildYear: ints.buildYear,
    livingAreaM2: ints.living,
    plotAreaM2: ints.plot,
    rooms,
    bathrooms: ints.baths,
    purchasePriceCents: price,
    purchaseYear,
    rented: f.rented,
    buildingSharePercent: share,
    nextRenovationYear: renovation,
  };
}

/** Figma frame 57 (choose the kind of property), then data and value. */
export function PropertyWizard(p: { onDone: (property: Property) => void; onExit: () => void }) {
  const [kind, setKind] = useState<PropertyKind | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [draft, setDraft] = useState<PropertyDraft | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function goBack() {
    if (draft) return setDraft(null);
    if (kind) return setKind(null);
    p.onExit();
  }

  function next(e: FormEvent) {
    e.preventDefault();
    const result = toDraft(kind!, form);
    if (typeof result === "string") return setError(result);
    setError("");
    setValue(result.purchasePriceCents ? formatWhole(result.purchasePriceCents) : "");
    setDraft(result);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !draft) return;
    const cents = parseMoney(value);
    if (cents === null) return setError("Bitte gib einen gültigen Wert ein.");
    setBusy(true);
    try {
      p.onDone(await api.addProperty(draft, cents));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const text = (key: keyof Form, label: string, extra: { numeric?: boolean; wide?: boolean; autoFocus?: boolean } = {}) => (
    <label className={extra.wide ? "pw__wide" : undefined}>
      <span>{label}</span>
      <input
        value={form[key] as string}
        onChange={set(key)}
        inputMode={extra.numeric ? "decimal" : undefined}
        maxLength={60}
        spellCheck={false}
        autoFocus={extra.autoFocus}
      />
    </label>
  );

  return (
    <div className="vw">
      <button className="vw__back" onClick={goBack} aria-label="Zurück">
        <img src={back} alt="" />
      </button>
      <div className="vw__card" />
      <h2 className="vw__title">Immobilie</h2>
      <img className="vw__caricon pw__icon" src={houseIcon} alt="" />

      {!kind && (
        <>
          <div className="vw__line vw__line--v1" />
          <div className="vw__line vw__line--v2" />
          <div className="vw__line vw__line--h" />
          <div className="vw__step">
            <button className="vw__opt pw__opt--haus" onClick={() => setKind("haus")}>
              <img src={house} alt="" />
              <span>Haus</span>
            </button>
            <button className="vw__opt pw__opt--wohnung" onClick={() => setKind("wohnung")}>
              <img src={flat} alt="" />
              <span>Wohnung</span>
            </button>
            <button className="vw__opt pw__opt--garage" onClick={() => setKind("garage")}>
              <i />
              <img src={garage} alt="" />
              <span>
                Garage/
                <br />
                Stellplatz
              </span>
            </button>
            <button className="vw__opt pw__opt--gewerbe" onClick={() => setKind("gewerbe")}>
              <img src={commercial} alt="" />
              <span>Gewerbeimmobilie</span>
            </button>
          </div>
        </>
      )}

      {kind && (
        <>
          <div className="vw__line vw__line--v1" />
          <p className="pw__kind">{PROPERTY_KIND_LABEL[kind]}</p>
          <form className="pw__form" onSubmit={next} noValidate>
            <fieldset>
              <legend>Lage</legend>
              {text("name", "Bezeichnung (z. B. Holiday House)", { wide: true, autoFocus: true })}
              {text("street", "Straße und Hausnummer", { wide: true })}
              {text("postalCode", "PLZ")}
              {text("city", "Ort")}
              <label className="pw__wide">
                <span>Bundesland</span>
                <select value={form.state} onChange={set("state")}>
                  <option value="">–</option>
                  {STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </fieldset>
            <fieldset>
              <legend>Eckdaten</legend>
              {text("buildYear", "Baujahr", { numeric: true })}
              {text("rooms", "Zimmer", { numeric: true })}
              {text("livingArea", "Wohnfläche (m²)", { numeric: true })}
              {text("plotArea", "Grundfläche (m²)", { numeric: true })}
              {text("bathrooms", "Badezimmer", { numeric: true })}
              {text("nextRenovation", "Nächste Renovierung (Jahr)", { numeric: true })}
            </fieldset>
            <fieldset>
              <legend>Kauf</legend>
              {text("purchasePrice", "Kaufpreis (€)", { numeric: true })}
              {text("purchaseYear", "Kaufjahr", { numeric: true })}
            </fieldset>
            <fieldset>
              <legend>Vermietung</legend>
              <label className="pw__check">
                <input type="checkbox" checked={form.rented} onChange={(e) => setForm({ ...form, rented: e.target.checked })} />
                Vermietet
              </label>
              {form.rented && text("buildingShare", "Gebäudeanteil am Kaufpreis (%)", { numeric: true })}
              <p className="pw__hint">
                {form.rented
                  ? "Für die Abschreibung (AfA) zählt nur das Gebäude, nicht das Grundstück. Den Anteil kennt dein Steuerberater oder der Kaufvertrag."
                  : "Bei selbst genutzten Immobilien gibt es keine steuerliche Abschreibung."}
              </p>
            </fieldset>
            <p className="form-error" role="alert">
              {!draft && error}
            </p>
            <button className="vw__ok pw__next">Weiter</button>
          </form>
        </>
      )}

      {draft && (
        <form className="vw__overlay" onSubmit={save}>
          <p className="vw__otext">
            Wie viel ist deine Immobilie heute wert?
            <br />
            <br />
            Du kannst den Wert jederzeit ändern.
          </p>
          <p className="vw__onote">
            Immobilienpreise hängen stark von der Lage ab, deshalb schätzen wir hier nichts automatisch. Gute Quellen: Gutachten,
            Kaufpreis, Angebote vergleichbarer Objekte.
          </p>
          <div className="vw__valuebox">
            <label>
              Wert:
              <span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  maxLength={16}
                  autoFocus
                />
                <img src={edit} alt="" />
              </span>
            </label>
            <button className="vw__confirm" disabled={busy} aria-label="Immobilie speichern" title="Speichern" />
            <button type="button" className="vw__cancel" onClick={() => setDraft(null)} aria-label="Abbrechen" title="Abbrechen" />
            <p className="form-error" role="alert">
              {error}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
