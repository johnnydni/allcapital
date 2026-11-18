import { useState } from "react";
import type { ValuePoint } from "../lib/api";
import { formatCents } from "../lib/money";
import close from "../assets/close.png";
import help from "../assets/help.png";
import plus from "../assets/plus.png";

export type Tool = {
  id: string;
  label: string;
  /** Background colour of the button, from the Figma toolbars. */
  color: string;
  img?: string;
  onClick?: () => void;
};

/** The floating toolbar above every asset screen. Tools without onClick are shown but disabled. */
export function AssetToolbar({ tools }: { tools: Tool[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const label = tools.find((t) => t.id === hover)?.label;
  return (
    <div className="va__bar" onMouseLeave={() => setHover(null)}>
      {tools.map((t, i) => (
        <button
          key={t.id}
          className={`va__tool ${t.color === "none" ? "va__tool--bare" : ""}`}
          style={{ left: `${2.4 + i * 7}rem`, background: t.color === "none" ? undefined : t.color }}
          aria-disabled={!t.onClick}
          aria-label={t.label || "Weitere Aktion"}
          title={t.onClick ? undefined : "Noch nicht verfügbar"}
          onClick={t.onClick}
          onMouseEnter={() => setHover(t.id)}
          onFocus={() => setHover(t.id)}
          onBlur={() => setHover(null)}
        >
          <img src={t.img ?? plus} alt="" />
        </button>
      ))}
      {label ? <span className="va__barlabel">{label}</span> : <img className="va__help" src={help} alt="" />}
    </div>
  );
}

/** Close button and the (inactive) PRO add button shared by asset screens. */
export function AssetChrome({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button className="va__close" onClick={onClose} aria-label="Schließen">
        <img src={close} alt="" />
      </button>
      <div className="va__pro" title="Noch nicht verfügbar">
        <img src={plus} alt="" />
        <span>PRO</span>
      </div>
      <div className="va__card" />
    </>
  );
}

const pct = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return null;
  const tone = change < 0 ? "down" : "up";
  return (
    <p className={`va__change va__change--${tone}`}>
      <i />
      {pct.format(Math.abs(change) * 100)}%
    </p>
  );
}

const BOX = { x0: 0, x1: 184, y0: 6, y1: 196 };

/** Maps a series of values onto the chart box. One point becomes a flat line. */
function chartPoints(values: number[]): [number, number][] {
  const series = values.length === 1 ? [values[0]!, values[0]!] : values;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series.map((cents, i) => [
    BOX.x0 + ((BOX.x1 - BOX.x0) * i) / (series.length - 1),
    max === min ? (BOX.y0 + BOX.y1) / 2 : BOX.y1 - ((cents - min) / span) * (BOX.y1 - BOX.y0),
  ]);
}

/** The small value-history chart with its label, in the Figma position. */
export function ValueChart({ values, down, label }: { values: number[]; down: boolean; label?: number }) {
  if (values.length === 0) return null;
  const tone = down ? "down" : "up";
  const points = chartPoints(values);
  const last = points[points.length - 1]!;
  return (
    <>
      <svg className={`va__chart va__chart--${tone}`} viewBox="-8 0 204 204" aria-hidden="true">
        <path className="va__axis" d="M0 0V200H202" />
        <path className="va__marker" d={`M${last[0]} 0V200`} />
        <polyline points={points.map((pt) => pt.join(",")).join(" ")} />
        <circle cx={last[0]} cy={last[1]} r="10" />
      </svg>
      <p className={`va__chartlabel va__change--${tone}`}>{formatCents(label ?? values[values.length - 1]!)}</p>
    </>
  );
}

/**
 * Accumulated gain or loss of a group over time: at each recorded change, the
 * sum of (value then − first value) over the items that existed. Buying or
 * removing items does not move the line, and it ends at the group's total
 * gain, so it always agrees with the "Wertsteigerung/Wertverlust" figure.
 */
export function groupGainSeries(items: { history: ValuePoint[] }[]): number[] {
  const times = [...new Set(items.flatMap((i) => i.history.map((h) => h.at)))].sort((a, b) => a - b);
  if (times.length === 0) return [];
  const gainAt = (t: number) =>
    items.reduce((sum, item) => {
      let latest: number | undefined;
      for (const h of item.history) if (h.at <= t) latest = h.cents;
      return latest === undefined ? sum : sum + latest - item.history[0]!.cents;
    }, 0);
  // Starts at zero: before anything was recorded there was no gain or loss.
  return [0, ...times.map(gainAt)];
}
