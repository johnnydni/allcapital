import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  api,
  errorMessage,
  type Condition,
  type Drive,
  type Estimate,
  type Vehicle,
  type VehicleDraft,
  type VehicleKind,
} from "../lib/api";
import { formatWhole, parseInteger, parseMoney } from "../lib/money";
import { CONDITION_LABEL } from "../lib/vehicles";
import addImage from "../assets/add-image.png";
import back from "../assets/back.png";
import alfa from "../assets/brand-alfa.png";
import audi from "../assets/brand-audi.png";
import bmw from "../assets/brand-bmw.png";
import mercedes from "../assets/brand-mercedes.png";
import porsche from "../assets/brand-porsche.png";
import vw from "../assets/brand-vw.png";
import carOutline from "../assets/car-outline.png";
import comboChart from "../assets/combo-chart.png";
import edit from "../assets/edit.png";
import bicycle from "../assets/kind-bicycle.png";
import car from "../assets/kind-car.png";
import kickscooter from "../assets/kind-kickscooter.png";
import motorbike from "../assets/kind-motorbike.png";
import scooterFront from "../assets/kind-scooter-front.png";
import loading from "../assets/loading.png";
import plus from "../assets/plus.png";
import sparks from "../assets/sparks.png";

const BRANDS = [
  { name: "Volkswagen", img: vw, cls: "vw" },
  { name: "Audi", img: audi, cls: "audi" },
  { name: "Porsche", img: porsche, cls: "porsche" },
  { name: "Alfa Romeo", img: alfa, cls: "alfa" },
  { name: "BMW", img: bmw, cls: "bmw" },
  { name: "Mercedes-Benz", img: mercedes, cls: "mercedes" },
];
const CONDITIONS: Condition[] = ["schlecht", "mittel", "gut", "sehr_gut"];
const EQUIPMENT_SLOTS = 5;
const MIN_ESTIMATE_MS = 1200;

type Data = {
  model: string;
  variant: string;
  buildYear: string;
  firstRegistration: string;
  powerPs: string;
  mileageKm: string;
  purchasePrice: string;
  purchaseYear: string;
};
const EMPTY_DATA: Data = {
  model: "",
  variant: "",
  buildYear: "",
  firstRegistration: "",
  powerPs: "",
  mileageKm: "",
  purchasePrice: "",
  purchaseYear: "",
};

type Overlay =
  | { phase: "estimating" }
  | { phase: "result"; estimate: Estimate | null; reason: string | null }
  | { phase: "error"; message: string };

function checkData(d: Data): string {
  const year = new Date().getFullYear();
  const validYear = (v: string) => /^\d{4}$/.test(v) && +v >= 1886 && +v <= year + 1;
  if (!d.model.trim()) return "Bitte gib das Modell an.";
  if (!validYear(d.buildYear)) return "Bitte gib ein gültiges Baujahr an.";
  if (!validYear(d.firstRegistration) || +d.firstRegistration < +d.buildYear)
    return "Bitte gib eine gültige Erstzulassung an.";
  if (d.powerPs && !parseInteger(d.powerPs)) return "Die Leistung ist ungültig.";
  if (d.mileageKm && parseInteger(d.mileageKm) === null) return "Der Kilometerstand ist ungültig.";
  if (!!d.purchasePrice !== !!d.purchaseYear) return "Bitte gib Kaufpreis und Kaufjahr zusammen an.";
  if (d.purchasePrice && !parseMoney(d.purchasePrice)) return "Der Kaufpreis ist ungültig.";
  if (d.purchaseYear && (!validYear(d.purchaseYear) || +d.purchaseYear < +d.buildYear || +d.purchaseYear > year))
    return "Das Kaufjahr ist ungültig.";
  return "";
}

/** Figma frames 45–67 and 117–120: add a vehicle step by step, then value it. */
export function VehicleWizard(p: { onDone: (vehicle: Vehicle) => void; onExit: () => void }) {
  const [kind, setKind] = useState<VehicleKind | null>(null);
  const [drive, setDrive] = useState<Drive | null>(null);
  const [brand, setBrand] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [dataMode, setDataMode] = useState<"choose" | "form" | "done">("choose");
  const [data, setData] = useState<Data>(EMPTY_DATA);
  const [dataError, setDataError] = useState("");
  const [condition, setCondition] = useState<Condition | null>(null);
  const [equipment, setEquipment] = useState<string[]>(() => Array(EQUIPMENT_SLOTS).fill(""));
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [value, setValue] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const step = !kind ? "kind" : kind === "automobil" && !drive ? "drive" : "details";

  function goBack() {
    if (overlay) return setOverlay(null);
    if (condition) return setCondition(null);
    if (dataMode !== "choose") return setDataMode(dataMode === "done" ? "form" : "choose");
    if (brand) return setBrand("");
    if (drive) return setDrive(null);
    if (kind) return setKind(null);
    p.onExit();
  }

  function draft(): VehicleDraft {
    return {
      kind: kind!,
      drive: kind === "automobil" ? drive : null,
      brand,
      model: data.model,
      variant: data.variant,
      buildYear: +data.buildYear,
      firstRegistration: +data.firstRegistration,
      condition: condition!,
      equipment: equipment.filter((e) => e.trim()),
      powerPs: data.powerPs ? parseInteger(data.powerPs) : null,
      mileageKm: data.mileageKm ? parseInteger(data.mileageKm) : null,
      purchasePriceCents: data.purchasePrice ? parseMoney(data.purchasePrice) : null,
      purchaseYear: data.purchaseYear ? +data.purchaseYear : null,
    };
  }

  async function startEstimate() {
    setOverlay({ phase: "estimating" });
    setSaveError("");
    try {
      const [result] = await Promise.all([
        api.estimateVehicle(draft()),
        new Promise((r) => setTimeout(r, MIN_ESTIMATE_MS)),
      ]);
      if (!alive.current) return;
      setValue(result.estimate ? formatWhole(result.estimate.midCents) : "");
      setOverlay({ phase: "result", ...result });
    } catch (err) {
      if (alive.current) setOverlay({ phase: "error", message: errorMessage(err) });
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || overlay?.phase !== "result") return;
    const cents = parseMoney(value);
    if (cents === null) return setSaveError("Bitte gib einen gültigen Wert ein.");
    setBusy(true);
    try {
      const source = overlay.estimate && cents === overlay.estimate.midCents ? "estimate" : "manual";
      p.onDone(await api.addVehicle(draft(), cents, source));
    } catch (err) {
      setSaveError(errorMessage(err));
      setBusy(false);
    }
  }

  function submitData(e: FormEvent) {
    e.preventDefault();
    const problem = checkData(data);
    setDataError(problem);
    if (!problem) setDataMode("done");
  }

  const field = (key: keyof Data, label: string, extra: { numeric?: boolean; autoFocus?: boolean } = {}) => (
    <label>
      <span>{label}</span>
      <input
        value={data[key]}
        onChange={(e) => setData({ ...data, [key]: e.target.value })}
        inputMode={extra.numeric ? "numeric" : undefined}
        maxLength={60}
        autoFocus={extra.autoFocus}
        spellCheck={false}
      />
    </label>
  );

  const chosenBrand = BRANDS.find((b) => b.name === brand);

  return (
    <div className="vw">
      <button className="vw__back" onClick={goBack} aria-label="Zurück">
        <img src={back} alt="" />
      </button>
      <div className="vw__card" />
      <div className="vw__line vw__line--v1" />
      <div className="vw__line vw__line--v2" />
      {step !== "drive" && <div className="vw__line vw__line--h" />}
      <h2 className="vw__title">Mobilität</h2>
      <img className="vw__caricon" src={carOutline} alt="" />
      {step === "details" && (
        <button className="vw__photo" disabled title="Foto hinzufügen – noch nicht verfügbar">
          <img src={addImage} alt="" />
          <span>PRO</span>
        </button>
      )}

      {step === "kind" && (
        <div className="vw__step">
          <button className="vw__opt vw__opt--car" onClick={() => setKind("automobil")}>
            <img src={car} alt="" />
            <span>Automobil</span>
          </button>
          <button className="vw__opt vw__opt--bicycle" onClick={() => setKind("fahrrad")}>
            <img src={bicycle} alt="" />
            <span>Fahrräder</span>
          </button>
          <button className="vw__opt vw__opt--escooter" onClick={() => setKind("escooter")}>
            <img src={kickscooter} alt="" />
            <span>E-Scooter</span>
          </button>
          <button className="vw__opt vw__opt--motorbike" onClick={() => setKind("motorrad")}>
            <img src={motorbike} alt="" />
            <img className="vw__opt-extra" src={scooterFront} alt="" />
            <span>Motorräder</span>
          </button>
        </div>
      )}

      {step === "drive" && (
        <div className="vw__step">
          <button className="vw__opt vw__opt--combustion" onClick={() => setDrive("verbrenner")}>
            <img src={car} alt="" />
            <span>Verbrenner</span>
          </button>
          <button className="vw__opt vw__opt--electric" onClick={() => setDrive("elektro")}>
            <img src={car} alt="" />
            <img className="vw__opt-extra" src={sparks} alt="" />
            <span>E-Autos / Hybride</span>
          </button>
        </div>
      )}

      {step === "details" && (
        <div className="vw__step">
          <h3 className="vw__h vw__h--brand">Marke</h3>
          {!brand ? (
            <>
              {kind === "automobil" &&
                BRANDS.map((b) => (
                  <button
                    key={b.name}
                    className={`vw__brand vw__brand--${b.cls}`}
                    onClick={() => setBrand(b.name)}
                    aria-label={b.name}
                    title={b.name}
                  >
                    <img src={b.img} alt="" />
                  </button>
                ))}
              <form
                className={`vw__brandform ${kind === "automobil" ? "" : "vw__brandform--only"}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (brandInput.trim()) setBrand(brandInput.trim());
                }}
              >
                <input
                  placeholder={kind === "automobil" ? "Andere Marke" : "Marke eingeben"}
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  maxLength={60}
                  autoFocus={kind !== "automobil"}
                />
                <button className="vw__ok" disabled={!brandInput.trim()}>
                  OK
                </button>
              </form>
            </>
          ) : (
            <>
              {chosenBrand && <img className="vw__brandlogo" src={chosenBrand.img} alt="" />}
              <p className={`vw__brandname ${chosenBrand ? "" : "vw__brandname--solo"}`}>{brand.toUpperCase()}</p>
              <h3 className="vw__h vw__h--data">Fahrzeugdaten</h3>
              {dataMode === "choose" && (
                <>
                  <button className="vw__manual" onClick={() => setDataMode("form")}>
                    Manuelle
                    <br />
                    Eingabe
                  </button>
                  <button className="vw__scan" disabled title="Noch nicht verfügbar">
                    Scan
                    <br />
                    Fahrzeug-Brief
                    <img src={addImage} alt="" />
                  </button>
                </>
              )}
              {dataMode === "form" && (
                <form className="vw__dataform" onSubmit={submitData} noValidate>
                  {field("model", "Modell", { autoFocus: true })}
                  {field("variant", "Variante")}
                  {field("buildYear", "Baujahr", { numeric: true })}
                  {field("firstRegistration", "Erstzulassung", { numeric: true })}
                  {field("powerPs", "Leistung (PS)", { numeric: true })}
                  {field("mileageKm", "Kilometer", { numeric: true })}
                  {field("purchasePrice", "Kaufpreis (€)", { numeric: true })}
                  {field("purchaseYear", "Kaufjahr", { numeric: true })}
                  <p className="form-error" role="alert">
                    {dataError}
                  </p>
                  <button className="vw__ok">Übernehmen</button>
                </form>
              )}
              {dataMode === "done" && (
                <button className="vw__datavalues" onClick={() => setDataMode("form")} title="Daten ändern">
                  <Fact label="Modell" value={data.model} />
                  <Fact label="Variante" value={data.variant || "–"} />
                  <Fact label="Baujahr" value={data.buildYear} />
                  <Fact label="Erstzulassung" value={data.firstRegistration} />
                </button>
              )}
            </>
          )}

          {dataMode === "done" && (
            <>
              <h3 className="vw__h vw__h--cond">Zustand</h3>
              {!condition ? (
                <>
                  <img className="vw__condicon" src={comboChart} alt="" />
                  {CONDITIONS.map((c, i) => (
                    <button key={c} className={`vw__cond vw__cond--${i}`} onClick={() => setCondition(c)}>
                      {CONDITION_LABEL[c]}
                    </button>
                  ))}
                </>
              ) : (
                <button className="vw__condvalue" onClick={() => setCondition(null)} title="Zustand ändern">
                  {CONDITION_LABEL[condition]}
                  <img src={comboChart} alt="" />
                </button>
              )}
            </>
          )}

          {condition && (
            <>
              <h3 className="vw__h vw__h--equip">Ausstattung</h3>
              {equipment.map((item, i) => (
                <label key={i} className={`vw__equip vw__equip--${i} ${item ? "is-set" : ""}`}>
                  <img src={plus} alt="" />
                  <input
                    value={item}
                    maxLength={40}
                    aria-label={`Ausstattung ${i + 1}`}
                    onChange={(e) => setEquipment(equipment.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                </label>
              ))}
              <button className="vw__next" onClick={startEstimate} aria-label="Wert ermitteln" title="Wert ermitteln">
                <img src={plus} alt="" />
              </button>
            </>
          )}
        </div>
      )}

      {overlay && (
        <form className="vw__overlay" onSubmit={save}>
          {overlay.phase === "estimating" && (
            <>
              <p className="vw__otext">
                Wir ermitteln den Wert deines Fahrzeugs anhand deiner Angaben.
                <br />
                <br />
                Das dauert einen kurzen Moment.
              </p>
              <img className="vw__spinner" src={loading} alt="" />
            </>
          )}
          {overlay.phase === "error" && (
            <>
              <p className="vw__otext">Das hat leider nicht geklappt.</p>
              <p className="vw__onote">{overlay.message}</p>
            </>
          )}
          {overlay.phase === "result" && (
            <>
              <p className="vw__otext">
                {overlay.estimate ? (
                  <>
                    Unsere Schätzung:
                    <br />
                    {formatWhole(overlay.estimate.lowCents)} – {formatWhole(overlay.estimate.highCents)}
                  </>
                ) : (
                  <>Keine Schätzung möglich.</>
                )}
                <br />
                <br />
                Du kannst den Wert jetzt oder auch später jederzeit manuell ändern.
              </p>
              <p className="vw__onote">
                {overlay.estimate
                  ? "Faustformel aus Kaufpreis, Alter, Zustand und Laufleistung – kein Marktwert."
                  : overlay.reason}
              </p>
              <div className="vw__done">
                <img src={loading} alt="" />
              </div>
              <div className="vw__valuebox">
                <label>
                  Wert:
                  <span>
                    {overlay.estimate && "Ca. "}
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
                <button className="vw__confirm" disabled={busy} aria-label="Fahrzeug speichern" title="Speichern" />
                <button
                  type="button"
                  className="vw__cancel"
                  onClick={() => setOverlay(null)}
                  aria-label="Abbrechen"
                  title="Abbrechen"
                />
                <p className="form-error" role="alert">
                  {saveError}
                </p>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="vw__fact">
      {label}
      <b>{value}</b>
    </span>
  );
}
