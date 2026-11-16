const CRESCENT = "M66.93 7.23A46 46 0 1 0 89.21 74.06A36 36 0 0 1 66.93 7.23Z";

/** Crescent mark. `layers` adds the trailing grey copies from the splash animation. */
export function Logo({ layers = 0, className = "" }: { layers?: 0 | 1 | 2; className?: string }) {
  return (
    <svg className={`logo logo--l${layers} ${className}`} viewBox="0 0 112 112" aria-hidden="true">
      <path className="logo__s2" d={CRESCENT} />
      <path className="logo__s1" d={CRESCENT} />
      <path d={CRESCENT} />
    </svg>
  );
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <div className="wordmark">
      <Logo />
      <span>All Capital.</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

/** Header used throughout the registration and onboarding designs. */
export function PrototypeHeader() {
  return (
    <header className="proto">
      <Wordmark />
      <div className="proto__title">Prototyp</div>
      <div className="proto__sub">WORK IN PROGRESS</div>
    </header>
  );
}
