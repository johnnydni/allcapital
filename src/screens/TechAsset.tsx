import { useState, type FormEvent } from "react";
import {
  api,
  errorMessage,
  type Condition,
  type Device,
  type DeviceDraft,
  type DeviceKind,
  type Estimate,
} from "../lib/api";
import { DEVICE_KIND_LABEL } from "../lib/devices";
import { formatCents, formatWhole, parseInteger, parseMoney } from "../lib/money";
import { CONDITION_LABEL, currentValue, groupChange, lastMove, totalGain, totalValue } from "../lib/vehicles";
import { AssetChrome, AssetToolbar, ChangeBadge, ValueChart, groupGainSeries } from "../components/AssetParts";
import cpu from "../assets/dev-cpu.svg";
import gpu from "../assets/dev-gpu.svg";
import monitor from "../assets/dev-monitor.png";
import ramA from "../assets/dev-ram-a.svg";
import ramB from "../assets/dev-ram-b.svg";
import monitorIcon from "../assets/monitor-icon.png";
import plus from "../assets/plus.png";
import transaction from "../assets/transaction.png";

const KINDS = Object.keys(DEVICE_KIND_LABEL) as DeviceKind[];
const CONDITIONS: Condition[] = ["schlecht", "mittel", "gut", "sehr_gut"];
const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

function DeviceIcon({ kind }: { kind: DeviceKind }) {
  switch (kind) {
    case "grafikkarte":
      return <img className="ta__icon ta__icon--gpu" src={gpu} alt="" />;
    case "prozessor":
      return <img className="ta__icon ta__icon--cpu" src={cpu} alt="" />;
    case "arbeitsspeicher":
      return (
        <span className="ta__icon ta__icon--ram">
          <img src={ramA} alt="" />
          <img src={ramB} alt="" />
        </span>
      );
    case "monitor":
      return <img className="ta__icon ta__icon--monitor" src={monitor} alt="" />;
    default:
      return <img className="ta__icon ta__icon--generic" src={monitorIcon} alt="" />;
  }
}

type Panel = { mode: "add" } | { mode: "detail"; id: string } | null;

/** Figma frame "Tech Preview Overlay": all devices as cards. */
export function TechAsset(p: {
  devices: Device[];
  startAdding: boolean;
  onAdded: (device: Device) => void;
  onChanged: (device: Device) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(p.startAdding || p.devices.length === 0 ? { mode: "add" } : null);
  const change = groupChange(p.devices);
  const gain = totalGain(p.devices);
  const selected = panel?.mode === "detail" ? p.devices.find((d) => d.id === panel.id) : undefined;
  const add = () => setPanel({ mode: "add" });

  return (
    <div className="va">
      <AssetToolbar
        tools={[
          { id: "new", label: "Gerät hinzufügen", color: "#ebebeb", onClick: add },
          { id: "tool", label: "Neues Tool", color: "#8dc6ef" },
          { id: "expense", label: "", color: "#ee8d8d" },
          { id: "sell", label: "Gerät verkaufen", color: "#c5fcc7", img: monitorIcon },
          { id: "transactions", label: "Transaktionen", color: "#eef4a6", img: transaction },
        ]}
      />
      <AssetChrome onClose={p.onClose} />

      <h2 className="va__title">Tech</h2>
      <ChangeBadge change={change} />
      <img className="va__caricon ta__headicon" src={monitorIcon} alt="" />
      <p className="va__value">{formatCents(totalValue(p.devices))}</p>
      <ValueChart values={groupGainSeries(p.devices)} down={change !== null && change < 0} label={totalValue(p.devices)} />
      {p.devices.some((d) => d.history.length > 1) && (
        <>
          <p className="va__deplabel">{gain < 0 ? "Wertverlust" : "Wertsteigerung"}</p>
          <p className="va__dep">
            {gain < 0 ? "- " : "+ "}
            {formatCents(Math.abs(gain))}
          </p>
        </>
      )}

      <div className="ta__grid">
        {p.devices.map((d) => {
          const move = lastMove(d);
          return (
            <button
              key={d.id}
              className={`ta__card ${selected?.id === d.id ? "is-active" : ""}`}
              onClick={() => setPanel({ mode: "detail", id: d.id })}
            >
              <span className="ta__name">{d.name}</span>
              <DeviceIcon kind={d.kind} />
              <span className={`ta__value ${move < 0 ? "is-down" : move > 0 ? "is-up" : ""}`}>{formatCents(currentValue(d))}</span>
            </button>
          );
        })}
      </div>
      <button className="ta__add ta__add--small" onClick={add} aria-label="Gerät hinzufügen">
        <img src={plus} alt="" />
      </button>
      <button className="ta__add ta__add--tall" onClick={add} aria-label="Gerät hinzufügen">
        <img src={plus} alt="" />
      </button>

      {panel && <div className="ta__backdrop" onClick={() => setPanel(null)} />}
      {panel?.mode === "add" && (
        <AddPanel
          onClose={() => setPanel(null)}
          onAdded={(d) => {
            p.onAdded(d);
            setPanel({ mode: "detail", id: d.id });
          }}
        />
      )}
      {selected && (
        <DetailPanel
          key={selected.id}
          device={selected}
          onChanged={p.onChanged}
          onDeleted={(id) => {
            setPanel(null);
            p.onDeleted(id);
          }}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

function AddPanel(p: { onAdded: (d: Device) => void; onClose: () => void }) {
  const [kind, setKind] = useState<DeviceKind>("computer");
  const [name, setName] = useState("");
  const [condition, setCondition] = useState<Condition>("gut");
  const [price, setPrice] = useState("");
  const [year, setYear] = useState("");
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [note, setNote] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function draft(): DeviceDraft | string {
    if (!name.trim()) return "Bitte gib eine Bezeichnung an.";
    if (!!price.trim() !== !!year.trim()) return "Bitte gib Kaufpreis und Kaufjahr zusammen an.";
    const priceCents = price.trim() ? parseMoney(price) : null;
    if (price.trim() && !priceCents) return "Der Kaufpreis ist ungültig.";
    const y = year.trim() ? parseInteger(year) : null;
    if (year.trim() && (y === null || y < 1970 || y > new Date().getFullYear())) return "Das Kaufjahr ist ungültig.";
    return { kind, name, condition, purchasePriceCents: priceCents, purchaseYear: y };
  }

  async function runEstimate() {
    const d = draft();
    if (typeof d === "string") return setError(d);
    setError("");
    try {
      const r = await api.estimateDevice(d);
      setEstimate(r.estimate);
      setNote(r.estimate ? "" : (r.reason ?? ""));
      if (r.estimate) setValue(formatWhole(r.estimate.midCents));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const d = draft();
    if (typeof d === "string") return setError(d);
    const cents = parseMoney(value);
    if (cents === null) return setError("Bitte gib den aktuellen Wert ein.");
    setBusy(true);
    try {
      const source = estimate && cents === estimate.midCents ? "estimate" : "manual";
      p.onAdded(await api.addDevice(d, cents, source));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="ta__panel" onSubmit={save} noValidate>
      <header>
        <h3>Neues Gerät</h3>
        <button type="button" onClick={p.onClose} aria-label="Schließen">
          ×
        </button>
      </header>
      <div className="ta__fields">
        <label>
          Art
          <select value={kind} onChange={(e) => setKind(e.target.value as DeviceKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {DEVICE_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Zustand
          <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="ta__wide">
          Bezeichnung (z. B. GPU - RTX 3080)
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus spellCheck={false} />
        </label>
        <label>
          Kaufpreis (€)
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" maxLength={16} />
        </label>
        <label>
          Kaufjahr
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" maxLength={4} />
        </label>
      </div>
      <button type="button" className="ta__secondary" onClick={runEstimate}>
        Wert schätzen
      </button>
      {estimate && (
        <p className="ta__estimate">
          Unsere Schätzung: {formatWhole(estimate.lowCents)} – {formatWhole(estimate.highCents)} €
          <small>Faustformel aus Kaufpreis, Alter und Zustand – kein Marktwert.</small>
        </p>
      )}
      {note && <p className="ta__estimate ta__estimate--none">{note}</p>}
      <label className="ta__valuefield">
        Aktueller Wert (€)
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0,00" maxLength={16} />
      </label>
      <p className="form-error" role="alert">
        {error}
      </p>
      <button className="ta__primary" disabled={busy}>
        Hinzufügen
      </button>
    </form>
  );
}

function DetailPanel(p: {
  device: Device;
  onChanged: (d: Device) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const d = p.device;
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  async function saveValue(e: FormEvent) {
    e.preventDefault();
    const cents = parseMoney(value);
    if (cents === null) return setError("Bitte gib einen gültigen Wert ein.");
    try {
      p.onChanged(await api.setDeviceValue(d.id, cents));
      setValue("");
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!confirm) return setConfirm(true);
    try {
      await api.deleteDevice(d.id);
      p.onDeleted(d.id);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="ta__panel">
      <header>
        <h3>{d.name}</h3>
        <button onClick={p.onClose} aria-label="Schließen">
          ×
        </button>
      </header>
      <dl className="ta__facts">
        <dt>Art</dt>
        <dd>{DEVICE_KIND_LABEL[d.kind]}</dd>
        <dt>Zustand</dt>
        <dd>{CONDITION_LABEL[d.condition]}</dd>
        {d.purchasePriceCents !== null && (
          <>
            <dt>Gekauft</dt>
            <dd>
              {d.purchaseYear} für {formatCents(d.purchasePriceCents)}
            </dd>
          </>
        )}
        <dt>Aktueller Wert</dt>
        <dd>
          <b>{formatCents(currentValue(d))}</b>
        </dd>
      </dl>
      <form className="ta__valueform" onSubmit={saveValue} noValidate>
        <label>
          Neuer Wert (€)
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" maxLength={16} />
        </label>
        <button className="ta__primary" disabled={!value.trim()}>
          Speichern
        </button>
      </form>
      <p className="form-error" role="alert">
        {error}
      </p>
      <h4>Verlauf</h4>
      <ul className="ta__history">
        {[...d.history].reverse().map((h, i) => (
          <li key={`${h.at}-${i}`}>
            <time>{dateFormat.format(new Date(h.at * 1000))}</time>
            <span>{h.source === "estimate" ? "Schätzung" : "Manuell"}</span>
            <b>{formatCents(h.cents)}</b>
          </li>
        ))}
      </ul>
      <button className="va__delete ta__delete" onClick={remove} onBlur={() => setConfirm(false)}>
        {confirm ? "Wirklich entfernen? Nochmal klicken." : "Gerät entfernen"}
      </button>
    </section>
  );
}
