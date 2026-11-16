import { useState, type FormEvent } from "react";
import { api, errorMessage, type JournalCategory, type Vehicle } from "../lib/api";
import { formatCents, parseInteger, parseMoney } from "../lib/money";
import {
  CATEGORY_LABEL,
  SECTION_CATEGORIES,
  currentValue,
  entriesOf,
  formatDate,
  serviceText,
  todayIso,
  totalKm,
  valueChange,
  yearSum,
  type JournalSection,
} from "../lib/vehicles";
import carIcon from "../assets/car-icon.png";
import close from "../assets/close.png";
import journalIcon from "../assets/journal.png";
import journalCar from "../assets/journal-car.png";
import journalCosts from "../assets/journal-costs.png";
import journalGallery from "../assets/journal-gallery.png";
import journalMechanic from "../assets/journal-mechanic.png";
import journalRoad from "../assets/journal-road.png";
import car from "../assets/kind-car.png";

const SECTION_TITLE: Record<JournalSection, string> = { kosten: "Kosten", wartung: "Wartung", reisen: "Reisen" };
const km = new Intl.NumberFormat("de-DE");
const percent = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" });

/** Figma frame "Mobilität Preview Overlay Wartungsbuch": the vehicle journal. */
export function VehicleJournal(p: {
  vehicle: Vehicle;
  onChanged: (vehicle: Vehicle) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const v = p.vehicle;
  const [section, setSection] = useState<JournalSection | null>(null);
  const change = valueChange(v);
  const visits = entriesOf(v, ["werkstatt"]).length;

  const card = (id: JournalSection) => ({
    className: `vj__card vj__card--${id} ${section === id ? "is-open" : ""}`,
    onClick: () => setSection(section === id ? null : id),
    "aria-expanded": section === id,
  });

  return (
    <div className="va vj">
      <div className="va__bar">
        <button className="vj__barpill" onClick={p.onBack} title="Zurück zur Übersicht">
          Auto-Tagebuch
          <span>
            <img src={journalIcon} alt="" />
          </span>
          <img src={journalIcon} alt="" />
        </button>
      </div>
      <button className="va__close" onClick={p.onClose} aria-label="Schließen">
        <img src={close} alt="" />
      </button>
      <div className="va__card" />
      <h2 className="va__title">Mobilität</h2>
      <img className="va__caricon" src={carIcon} alt="" />

      <button {...card("kosten")}>
        <h3>Kosten</h3>
        <dl>
          <Row label="Kraftfahrzeugsteuer" value={formatCents(yearSum(v, ["steuer"]))} />
          <Row label="Versicherung" value={formatCents(yearSum(v, ["versicherung"]))} />
          <Row label="Kraftstoff / Strom" value={formatCents(yearSum(v, ["kraftstoff"]))} />
          <Row label="Wertentwicklung" value={change === null ? "–" : `${percent.format(change * 100)} %`} />
        </dl>
        <small>Summen im laufenden Jahr</small>
        {v.monthlyDepreciationCents !== null && v.monthlyDepreciationCents > 0 && (
          <p className="vj__dep">
            Abschreibung
            <b>- {formatCents(v.monthlyDepreciationCents)}</b>
          </p>
        )}
        <p className="vj__worth">
          Aktueller Wert
          <b>{formatCents(currentValue(v))}</b>
        </p>
        <img className="vj__icon" src={journalCosts} alt="" />
      </button>

      <button {...card("wartung")}>
        <h3>Wartung</h3>
        <dl>
          <Row label="Werkstattbesuche" value={String(visits)} />
          <Row label="Werkstatt" value={formatCents(yearSum(v, ["werkstatt"]))} />
          <Row label="Teile" value={formatCents(yearSum(v, ["teile"]))} />
        </dl>
        <hr />
        <p className="vj__service">
          {v.nextService ? (
            <>
              <b>Werkstatt-besuch {serviceText(v.nextService).startsWith("über") ? "" : "in"}</b>
              {serviceText(v.nextService)}
            </>
          ) : (
            <span>Noch kein Werkstatttermin eingetragen</span>
          )}
        </p>
        <img className="vj__icon vj__icon--mechanic" src={journalMechanic} alt="" />
        <img className="vj__icon vj__icon--car" src={journalCar} alt="" />
      </button>

      <button {...card("reisen")}>
        <h3>Reisen</h3>
        <dl>
          <Row label="Fahrtenbuch" value={`${km.format(totalKm(v))} km`} />
          <Row label="Fahrten" value={String(entriesOf(v, ["fahrt"]).length)} />
        </dl>
        <img className="vj__icon" src={journalRoad} alt="" />
      </button>

      {section ? (
        <SectionPanel key={section} vehicle={v} section={section} onChanged={p.onChanged} onClose={() => setSection(null)} />
      ) : (
        <>
          <div className="vj__photo">
            <img src={car} alt="" />
          </div>
          <div className="va__label vj__label">
            <strong>
              {v.brand} {v.model}
              <br />
              {v.buildYear}
            </strong>
            <span>
              {v.powerPs !== null && <>{v.powerPs} PS</>}
              <br />
              {v.mileageKm !== null && <>{km.format(v.mileageKm)}km</>}
            </span>
          </div>
          <div className="vj__card vj__card--gallery" title="Noch nicht verfügbar">
            <h3>Fotogalerie</h3>
            <dl>
              <dt>Alben</dt>
              <dt>Videos</dt>
            </dl>
            <img className="vj__icon" src={journalGallery} alt="" />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function SectionPanel(p: {
  vehicle: Vehicle;
  section: JournalSection;
  onChanged: (vehicle: Vehicle) => void;
  onClose: () => void;
}) {
  const categories = SECTION_CATEGORIES[p.section];
  const trip = p.section === "reisen";
  const [date, setDate] = useState(todayIso);
  const [category, setCategory] = useState<JournalCategory>(categories[0]!);
  const [amount, setAmount] = useState("");
  const [distance, setDistance] = useState("");
  const [note, setNote] = useState("");
  const [service, setService] = useState(p.vehicle.nextService ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const entries = entriesOf(p.vehicle, categories);

  async function run(action: () => Promise<Vehicle>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      p.onChanged(await action());
      after?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const amountCents = trip ? null : parseMoney(amount);
    const kmValue = trip ? parseInteger(distance) : null;
    if (!date) return setError("Bitte wähle ein Datum.");
    if (!trip && amountCents === null) return setError("Bitte gib einen gültigen Betrag ein.");
    if (trip && !kmValue) return setError("Bitte gib die gefahrenen Kilometer an.");
    void run(
      () => api.addJournalEntry(p.vehicle.id, { date, category, amountCents, km: kmValue, note }),
      () => {
        setAmount("");
        setDistance("");
        setNote("");
      },
    );
  }

  return (
    <section className="vj__panel">
      <header>
        <h3>{SECTION_TITLE[p.section]}</h3>
        <button onClick={p.onClose} aria-label="Bereich schließen">
          ×
        </button>
      </header>

      {p.section === "wartung" && (
        <form
          className="vj__serviceform"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api.setNextService(p.vehicle.id, service || null));
          }}
        >
          <label>
            Nächster Werkstattbesuch
            <input type="date" value={service} onChange={(e) => setService(e.target.value)} />
          </label>
          <button disabled={busy || service === (p.vehicle.nextService ?? "")}>Speichern</button>
        </form>
      )}

      <form className="vj__form" onSubmit={add} noValidate>
        <label>
          Datum
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {categories.length > 1 && (
          <label>
            Art
            <select value={category} onChange={(e) => setCategory(e.target.value as JournalCategory)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>
        )}
        {trip ? (
          <label>
            Kilometer
            <input value={distance} onChange={(e) => setDistance(e.target.value)} inputMode="numeric" maxLength={9} />
          </label>
        ) : (
          <label>
            Betrag (€)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" maxLength={16} placeholder="0,00" />
          </label>
        )}
        <label className="vj__note">
          Notiz
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </label>
        <button disabled={busy}>Hinzufügen</button>
      </form>
      <p className="form-error" role="alert">
        {error}
      </p>

      <ul className="vj__list">
        {entries.length === 0 && <li className="vj__empty">Noch keine Einträge.</li>}
        {entries.map((e) => (
          <li key={e.id}>
            <time>{formatDate(e.date)}</time>
            <span>
              {CATEGORY_LABEL[e.category]}
              {e.note && <em>{e.note}</em>}
            </span>
            <b>{e.category === "fahrt" ? `${km.format(e.km ?? 0)} km` : formatCents(e.amountCents ?? 0)}</b>
            <button
              onClick={() => void run(() => api.deleteJournalEntry(p.vehicle.id, e.id))}
              aria-label="Eintrag löschen"
              title="Eintrag löschen"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
