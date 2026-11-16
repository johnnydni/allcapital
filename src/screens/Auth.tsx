import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, type Profile } from "../lib/api";
import { Icon } from "../components/Icon";
import { Logo } from "../components/Logo";

/** Frames 31–33: the crescent unfolds, then the entry controls fade in. */
export function Splash({ onContinue, onDemo }: { onContinue: () => void; onDemo: () => void }) {
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setStage(3);
      return;
    }
    const timers = [700, 1300, 1900].map((ms, i) =>
      window.setTimeout(() => setStage((i + 1) as 1 | 2 | 3), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  const ready = stage === 3;
  return (
    <section className="screen splash">
      <Logo className="splash__logo" layers={stage === 0 ? 0 : stage === 1 ? 1 : 2} />
      <button
        className={`round splash__go ${ready ? "is-in" : ""}`}
        onClick={onContinue}
        disabled={!ready}
        aria-label="Weiter"
      >
        <Icon name="arrowRight" />
      </button>
      <button className={`pill pill--dark side-pill ${ready ? "is-in" : ""}`} onClick={onDemo} disabled={!ready}>
        Demo
      </button>
    </section>
  );
}

/** Frame 34. */
export function Start(p: { onLogin: () => void; onUsers: () => void; onRegister: () => void; onBack: () => void }) {
  return (
    <section className="screen">
      <Logo className="corner-logo" layers={1} />
      <div className="start__choices">
        <button className="choice" onClick={p.onLogin}>
          <Icon name="arrowRight" />
          <span>Login</span>
        </button>
        <button className="choice" onClick={p.onUsers}>
          <Icon name="user" />
          <span>User</span>
        </button>
      </div>
      <button className="pill pill--green side-pill is-in" onClick={p.onRegister}>
        Register
      </button>
      <button className="round low-action low-action--sm" onClick={p.onBack} aria-label="Zurück">
        <Icon name="arrowLeft" />
      </button>
    </section>
  );
}

/** Frame 52. */
export function Login(p: { email?: string; onDone: (profile: Profile) => void; onClose: () => void }) {
  const [email, setEmail] = useState(p.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const profile = await api.login(email, password);
      setPassword("");
      p.onDone(profile);
    } catch (err) {
      setPassword("");
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const soon = { disabled: true, title: "Noch nicht verfügbar" } as const;
  return (
    <section className="screen">
      <Logo className="corner-logo" layers={1} />
      <form className="login" onSubmit={submit} noValidate>
        <h1>Anmelden</h1>
        <div className="login__social">
          <button type="button" className="login__google" {...soon}>
            <GoogleG />
            Anmelden mit Google
          </button>
          <div className="login__providers">
            {["hex", "office", "square", "f"].map((k) => (
              <button type="button" key={k} className={`provider provider--${k}`} {...soon} aria-label="Weiterer Anbieter" />
            ))}
          </div>
        </div>
        <p className="login__hint">oder verwenden Sie Ihre E-Mail, um sich anzumelden:</p>
        <label className="login__field">
          <Icon name="mail" />
          <input
            type="email"
            placeholder="Arbeits-E-Mail"
            autoComplete="username"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus={!p.email}
            required
          />
        </label>
        <label className="login__field">
          <Icon name="lock" />
          <input
            type="password"
            placeholder="Passwort"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={!!p.email}
            required
          />
        </label>
        <button type="button" className="login__link" {...soon}>
          Passwort vergessen?
        </button>
        <button className="login__submit" disabled={busy || !email || !password}>
          Anmelden
        </button>
        <button type="button" className="login__link login__link--center" {...soon}>
          Anmeldung mit SSO
        </button>
        <p className="form-error" role="alert">
          {error}
        </p>
      </form>
      <button className="round low-action" onClick={p.onClose} aria-label="Schließen">
        <Icon name="close" />
      </button>
    </section>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 18 18" className="google-g" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

/** Frame 53. */
export function Users(p: { onPick: (profile: Profile) => void; onAdd: () => void; onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .listProfiles()
      .then((list) => alive && setProfiles(list))
      .catch(() => alive && setProfiles([]));
    return () => {
      alive = false;
    };
  }, []);
  return (
    <section className="screen">
      <Logo className="corner-logo" layers={1} />
      <div className="users">
        {profiles?.length === 0 && <p className="users__empty">Noch kein Profil auf diesem Mac.</p>}
        {profiles?.map((profile, i) => (
          <button key={profile.id} className="users__item" onClick={() => p.onPick(profile)}>
            <span className={`avatar avatar--${i % 4}`}>{profile.displayName.slice(0, 1).toUpperCase()}</span>
            <span className="users__name">{profile.displayName}</span>
          </button>
        ))}
      </div>
      <button className="users__add" onClick={p.onAdd} aria-label="Profil hinzufügen">
        <Icon name="userAdd" />
      </button>
      <button className="round low-action" onClick={p.onClose} aria-label="Schließen">
        <Icon name="close" />
      </button>
    </section>
  );
}
