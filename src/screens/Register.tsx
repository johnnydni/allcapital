import { useState, type FormEvent } from "react";
import { api, errorMessage, type Language, type Profile } from "../lib/api";
import { Icon } from "../components/Icon";
import { PrototypeHeader } from "../components/Logo";

export const MIN_PASSWORD_LENGTH = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Frames 11 + 12.
 *
 * Deviation from the design, on purpose: the mock-ups verify e-mail and phone
 * with codes and send the first password by e-mail. Both need a server, which
 * a local-first app does not have. Step 2 therefore asks for the password in
 * the place where the design shows the ident codes.
 */
export function Register(p: { onDone: (profile: Profile) => void; onLogin: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<Language>("de");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const repeatOk = passwordOk && repeat === password;

  function validateStep1(): string {
    if (!firstName.trim() || !lastName.trim()) return "Bitte gib Vor- und Nachnamen an.";
    if (!EMAIL_RE.test(email.trim())) return "Bitte gib eine gültige E-Mail-Adresse an.";
    if (!terms || !privacy) return "Bitte stimme AGB und Datenschutzrichtlinien zu.";
    return "";
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = validateStep1();
    if (problem) {
      setStep(1);
      setError(problem);
      return;
    }
    if (step === 1) {
      setError("");
      setStep(2);
      return;
    }
    if (!repeatOk) {
      setError(
        passwordOk ? "Die Passwörter stimmen nicht überein." : `Das Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`,
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const profile = await api.register({
        firstName,
        lastName,
        email,
        phone,
        language,
        password,
        acceptTerms: terms,
        acceptPrivacy: privacy,
      });
      setPassword("");
      setRepeat("");
      p.onDone(profile);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <PrototypeHeader />
      <div className="reg__nav">
        <button type="button" className="btn" onClick={p.onLogin}>
          Log in
        </button>
        <button type="button" className="btn" onClick={() => setStep(1)}>
          Register
        </button>
      </div>
      <div className="divider" />
      <form className="reg" onSubmit={submit} noValidate>
        <h1>Registrieren</h1>
        <div className="reg__row">
          <Field icon="person" placeholder="Vorname" value={firstName} onChange={setFirstName} autoComplete="given-name" autoFocus />
          <Field icon="person" placeholder="Nachname" value={lastName} onChange={setLastName} autoComplete="family-name" />
        </div>
        <div className="reg__row">
          <Field icon="mail" type="email" placeholder="E-Mail Adresse" value={email} onChange={setEmail} autoComplete="email" />
          {step === 2 && (
            <Secret placeholder="Passwort" value={password} onChange={setPassword} ok={passwordOk} autoFocus />
          )}
        </div>
        <div className="reg__row">
          <Field icon="phone" type="tel" placeholder="Telefonnummer (optional)" value={phone} onChange={setPhone} autoComplete="tel" />
          {step === 2 && <Secret placeholder="Wiederholen" value={repeat} onChange={setRepeat} ok={repeatOk} />}
        </div>
        {step === 2 && (
          <p className="reg__codehint">
            Bitte wähle hier dein Passwort (mind. {MIN_PASSWORD_LENGTH} Zeichen). Es bleibt auf diesem Mac und kann
            nicht wiederhergestellt werden.
          </p>
        )}
        <div className="reg__row">
          <label className="field field--select">
            <span className="field__caret">▼</span>
            <Icon name="globe" />
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} aria-label="Sprache">
              <option value="de">DE</option>
              <option value="en">EN</option>
            </select>
          </label>
        </div>
        <div className="reg__foot">
          <p className="reg__note">{step === 1 ? "Dein Passwort legst du im nächsten Schritt fest." : ""}</p>
          <button className="btn" disabled={busy}>
            Auf gehts
          </button>
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
      </form>
      <div className="reg__consent">
        <Consent checked={terms} onChange={setTerms}>
          Hiermit stimme ich den <b>AGBs</b> von All Capital zu.
        </Consent>
        <Consent checked={privacy} onChange={setPrivacy}>
          Hiermit stimme ich den <b>Datenschutzrichtlinien</b> von All Capital zu.
        </Consent>
      </div>
    </section>
  );
}

type FieldProps = {
  icon: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
};

export function Field({ icon, onChange, type = "text", ...rest }: FieldProps) {
  return (
    <label className="field">
      <Icon name={icon} />
      <input type={type} spellCheck={false} maxLength={200} onChange={(e) => onChange(e.target.value)} {...rest} />
    </label>
  );
}

function Secret(p: { placeholder: string; value: string; onChange: (v: string) => void; ok: boolean; autoFocus?: boolean }) {
  return (
    <>
      <label className="field field--code">
        <Icon name="lock" />
        <input
          type="password"
          autoComplete="new-password"
          placeholder={p.placeholder}
          value={p.value}
          maxLength={256}
          autoFocus={p.autoFocus}
          onChange={(e) => p.onChange(e.target.value)}
        />
      </label>
      <span className={`tick ${p.ok ? "is-on" : ""}`}>
        <Icon name="check" />
      </span>
    </>
  );
}

function Consent(p: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="consent">
      <input type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.target.checked)} />
      <span className="consent__box">
        <Icon name="check" />
      </span>
      <span className="consent__text">{p.children}</span>
    </label>
  );
}

/** Frame 13. */
export function Nickname(p: { profile: Profile; onDone: (profile: Profile) => void }) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fullName = `${p.profile.firstName} ${p.profile.lastName}`.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      p.onDone(await api.setNickname(nickname));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <section className="screen">
      <PrototypeHeader />
      <form className="nick" onSubmit={submit}>
        <h1>Hi {fullName}!</h1>
        <p>Hast du einen Spitznamen? Oder bleiben wir bei {fullName}?</p>
        <div className="nick__row">
          <Field icon="person" placeholder={p.profile.firstName} value={nickname} onChange={setNickname} autoFocus />
          <button className="btn" disabled={busy}>
            Auf gehts
          </button>
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
      </form>
      <div className="divider" />
    </section>
  );
}
