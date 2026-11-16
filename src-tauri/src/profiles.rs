//! Local profiles: validation, password hashing and persistence.
//!
//! Passwords are hashed with Argon2id and never stored or logged. The profile
//! file is written atomically with owner-only permissions.
//!
//! NOTE: the profile file itself is not encrypted yet. It holds name, e-mail,
//! optional phone number and onboarding answers. Financial data must not be
//! added here; it belongs in the encrypted database (next milestone).

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::{Algorithm, Argon2, Params, Version};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

pub const MIN_PASSWORD_CHARS: usize = 10;
const MAX_PASSWORD_BYTES: usize = 1024;
const MAX_FIELD_CHARS: usize = 100;
const MAX_EMAIL_CHARS: usize = 254;
const FILE_NAME: &str = "profiles.json";
/// Version of the legal texts the user agreed to at registration.
const LEGAL_VERSION: &str = "draft-1";

pub const ERR_CREDENTIALS: &str = "E-Mail oder Passwort ist falsch.";
const ERR_STORAGE: &str = "Die Profildaten konnten nicht gelesen oder gespeichert werden.";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    De,
    En,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Position {
    Schueler,
    Student,
    Berufstaetig,
    Ruhestand,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetKind {
    Bank,
    Aktien,
    Krypto,
    Versicherung,
    Eigentum,
    Mobilitaet,
    Tech,
    Wertgegenstaende,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Hobby {
    Gaming,
    Filme,
    Sport,
    Reisen,
    Kochen,
    Schrauben,
    Fotografie,
    Andere,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Goal {
    Ueberblick,
    Verwalten,
    Umgang,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Knowledge {
    Neuling,
    Basics,
    Erfahren,
    Profi,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Onboarding {
    pub position: Position,
    pub assets: Vec<AssetKind>,
    pub hobbies: Vec<Hobby>,
    pub goals: Vec<Goal>,
    pub knowledge: Knowledge,
    pub improve: bool,
}

impl Onboarding {
    fn normalised(mut self) -> Result<Self, String> {
        fn dedup<T: PartialEq + Copy>(v: &mut Vec<T>) {
            let mut out: Vec<T> = Vec::with_capacity(v.len());
            for x in v.iter() {
                if !out.contains(x) {
                    out.push(*x);
                }
            }
            *v = out;
        }
        if self.assets.len() > 32 || self.hobbies.len() > 32 || self.goals.len() > 32 {
            return Err("Ungültige Auswahl.".into());
        }
        dedup(&mut self.assets);
        dedup(&mut self.hobbies);
        dedup(&mut self.goals);
        if self.assets.is_empty() || self.hobbies.is_empty() || self.goals.is_empty() {
            return Err("Bitte beantworte alle Fragen.".into());
        }
        Ok(self)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RegisterInput {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub language: Language,
    pub password: String,
    pub accept_terms: bool,
    pub accept_privacy: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct Consent {
    legal_version: String,
    accepted_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
struct Profile {
    id: String,
    first_name: String,
    last_name: String,
    #[serde(default)]
    nickname: String,
    email: String,
    #[serde(default)]
    phone: String,
    language: Language,
    password_hash: String,
    consent: Consent,
    #[serde(default)]
    onboarding: Option<Onboarding>,
    created_at: u64,
}

/// The only profile shape that ever leaves the backend.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicProfile {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub display_name: String,
    pub email: String,
    pub onboarding_done: bool,
}

impl From<&Profile> for PublicProfile {
    fn from(p: &Profile) -> Self {
        Self {
            id: p.id.clone(),
            first_name: p.first_name.clone(),
            last_name: p.last_name.clone(),
            display_name: if p.nickname.is_empty() { p.first_name.clone() } else { p.nickname.clone() },
            email: p.email.clone(),
            onboarding_done: p.onboarding.is_some(),
        }
    }
}

#[derive(Default, Serialize, Deserialize)]
struct FileFormat {
    version: u32,
    profiles: Vec<Profile>,
}

pub struct ProfileStore {
    dir: PathBuf,
}

impl ProfileStore {
    pub fn new(dir: PathBuf) -> Self {
        Self { dir }
    }

    fn path(&self) -> PathBuf {
        self.dir.join(FILE_NAME)
    }

    fn load(&self) -> Result<FileFormat, String> {
        match fs::read(self.path()) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| ERR_STORAGE.to_string()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(FileFormat { version: 1, profiles: vec![] }),
            Err(_) => Err(ERR_STORAGE.into()),
        }
    }

    /// Write to a temp file, fsync, then rename: a crash never leaves a half-written file.
    fn save(&self, data: &FileFormat) -> Result<(), String> {
        let write = || -> std::io::Result<()> {
            fs::create_dir_all(&self.dir)?;
            restrict(&self.dir, 0o700)?;
            let tmp = self.dir.join(format!("{FILE_NAME}.{}.tmp", uuid::Uuid::new_v4()));
            let mut opts = fs::OpenOptions::new();
            opts.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                opts.mode(0o600);
            }
            let result = (|| {
                let mut file = opts.open(&tmp)?;
                file.write_all(&serde_json::to_vec_pretty(data)?)?;
                file.sync_all()?;
                fs::rename(&tmp, self.path())
            })();
            if result.is_err() {
                let _ = fs::remove_file(&tmp);
            }
            result
        };
        write().map_err(|_| ERR_STORAGE.to_string())
    }

    pub fn list(&self) -> Result<Vec<PublicProfile>, String> {
        Ok(self.load()?.profiles.iter().map(PublicProfile::from).collect())
    }

    pub fn register(&self, input: &RegisterInput) -> Result<PublicProfile, String> {
        let first_name = clean_name(&input.first_name, "Vorname")?;
        let last_name = clean_name(&input.last_name, "Nachname")?;
        let email = clean_email(&input.email)?;
        let phone = clean_phone(&input.phone)?;
        if !input.accept_terms || !input.accept_privacy {
            return Err("Bitte stimme AGB und Datenschutzrichtlinien zu.".into());
        }
        check_password(&input.password)?;

        let mut data = self.load()?;
        if data.profiles.iter().any(|p| p.email == email) {
            return Err("Für diese E-Mail existiert bereits ein Profil.".into());
        }
        let now = now_secs();
        let profile = Profile {
            id: uuid::Uuid::new_v4().to_string(),
            first_name,
            last_name,
            nickname: String::new(),
            email,
            phone,
            language: input.language,
            password_hash: hash_password(&input.password)?,
            consent: Consent { legal_version: LEGAL_VERSION.into(), accepted_at: now },
            onboarding: None,
            created_at: now,
        };
        let public = PublicProfile::from(&profile);
        data.profiles.push(profile);
        self.save(&data)?;
        Ok(public)
    }

    /// Returns the profile if the credentials match. Unknown e-mails cost the
    /// same hashing time as wrong passwords.
    pub fn verify(&self, email: &str, password: &str) -> Result<PublicProfile, String> {
        let email = email.trim().to_lowercase();
        let data = self.load()?;
        let profile = data.profiles.iter().find(|p| p.email == email);
        let hash = profile.map(|p| p.password_hash.as_str()).unwrap_or_else(|| dummy_hash());
        let ok = password.len() <= MAX_PASSWORD_BYTES && verify_password(password, hash);
        match (profile, ok) {
            (Some(p), true) => Ok(p.into()),
            _ => Err(ERR_CREDENTIALS.into()),
        }
    }

    pub fn set_nickname(&self, id: &str, nickname: &str) -> Result<PublicProfile, String> {
        let nickname = nickname.trim();
        if nickname.chars().count() > MAX_FIELD_CHARS || nickname.chars().any(char::is_control) {
            return Err("Der Spitzname ist ungültig.".into());
        }
        self.update(id, |p| p.nickname = nickname.to_string())
    }

    pub fn save_onboarding(&self, id: &str, answers: Onboarding) -> Result<PublicProfile, String> {
        let answers = answers.normalised()?;
        self.update(id, |p| p.onboarding = Some(answers))
    }

    fn update(&self, id: &str, change: impl FnOnce(&mut Profile)) -> Result<PublicProfile, String> {
        let mut data = self.load()?;
        let profile = data.profiles.iter_mut().find(|p| p.id == id).ok_or("Profil nicht gefunden.")?;
        change(profile);
        let public = PublicProfile::from(&*profile);
        self.save(&data)?;
        Ok(public)
    }
}

fn restrict(path: &Path, mode: u32) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    }
    #[cfg(not(unix))]
    let _ = (path, mode);
    Ok(())
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn clean_name(raw: &str, label: &str) -> Result<String, String> {
    let v = raw.trim();
    if v.is_empty() || v.chars().count() > MAX_FIELD_CHARS || v.chars().any(char::is_control) {
        return Err(format!("{label} ist ungültig."));
    }
    Ok(v.to_string())
}

fn clean_email(raw: &str) -> Result<String, String> {
    let v = raw.trim().to_lowercase();
    let valid = v.chars().count() <= MAX_EMAIL_CHARS
        && !v.chars().any(|c| c.is_whitespace() || c.is_control())
        && matches!(v.split_once('@'), Some((local, domain))
            if !local.is_empty() && !domain.contains('@') && domain.contains('.')
               && !domain.starts_with('.') && !domain.ends_with('.'));
    if valid { Ok(v) } else { Err("Bitte gib eine gültige E-Mail-Adresse an.".into()) }
}

fn clean_phone(raw: &str) -> Result<String, String> {
    let v = raw.trim();
    let valid = v.chars().count() <= 30 && v.chars().all(|c| c.is_ascii_digit() || " +-/()".contains(c));
    if valid { Ok(v.to_string()) } else { Err("Die Telefonnummer ist ungültig.".into()) }
}

fn check_password(password: &str) -> Result<(), String> {
    if password.chars().count() < MIN_PASSWORD_CHARS {
        return Err(format!("Das Passwort braucht mindestens {MIN_PASSWORD_CHARS} Zeichen."));
    }
    if password.len() > MAX_PASSWORD_BYTES {
        return Err("Das Passwort ist zu lang.".into());
    }
    Ok(())
}

/// Argon2id, 64 MiB, 3 passes. Parameters are stored inside each hash, so they
/// can be raised later without breaking existing profiles.
fn hasher() -> Argon2<'static> {
    let params = Params::new(64 * 1024, 3, 1, None).expect("static argon2 params");
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    hasher()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| "Das Passwort konnte nicht verarbeitet werden.".to_string())
}

fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|parsed| hasher().verify_password(password.as_bytes(), &parsed).is_ok())
        .unwrap_or(false)
}

fn dummy_hash() -> &'static str {
    static HASH: OnceLock<String> = OnceLock::new();
    HASH.get_or_init(|| hash_password("timing-equaliser-not-a-real-password").unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(email: &str, password: &str) -> RegisterInput {
        RegisterInput {
            first_name: " Felix ".into(),
            last_name: "J.".into(),
            email: email.into(),
            phone: "+49 170 1234567".into(),
            language: Language::De,
            password: password.into(),
            accept_terms: true,
            accept_privacy: true,
        }
    }

    fn answers() -> Onboarding {
        Onboarding {
            position: Position::Student,
            assets: vec![AssetKind::Bank, AssetKind::Bank, AssetKind::Krypto],
            hobbies: vec![Hobby::Sport],
            goals: vec![Goal::Ueberblick],
            knowledge: Knowledge::Basics,
            improve: true,
        }
    }

    #[test]
    fn full_lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let store = ProfileStore::new(dir.path().join("data"));
        assert!(store.list().unwrap().is_empty());

        let created = store.register(&input("Felix@Example.com ", "correct horse battery")).unwrap();
        assert_eq!(created.email, "felix@example.com");
        assert_eq!(created.display_name, "Felix");
        assert!(!created.onboarding_done);

        assert!(store.register(&input("felix@example.com", "another password")).is_err());
        assert_eq!(store.verify("FELIX@example.com", "correct horse battery").unwrap().id, created.id);
        assert_eq!(store.verify("felix@example.com", "wrong password!").unwrap_err(), ERR_CREDENTIALS);
        assert_eq!(store.verify("nobody@example.com", "correct horse battery").unwrap_err(), ERR_CREDENTIALS);

        assert_eq!(store.set_nickname(&created.id, " Fe ").unwrap().display_name, "Fe");
        assert!(store.save_onboarding(&created.id, answers()).unwrap().onboarding_done);
        assert!(store.set_nickname("missing", "x").is_err());

        let raw = fs::read_to_string(dir.path().join("data").join(FILE_NAME)).unwrap();
        assert!(!raw.contains("correct horse battery"));
        assert!(raw.contains("$argon2id$"));
        assert_eq!(raw.matches("\"bank\"").count(), 1, "duplicates are removed");
    }

    #[cfg(unix)]
    #[test]
    fn file_is_owner_only() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let store = ProfileStore::new(dir.path().join("data"));
        store.register(&input("a@b.de", "long enough pw")).unwrap();
        let mode = |p: PathBuf| fs::metadata(p).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode(dir.path().join("data").join(FILE_NAME)), 0o600);
        assert_eq!(mode(dir.path().join("data")), 0o700);
    }

    #[test]
    fn rejects_bad_input() {
        let dir = tempfile::tempdir().unwrap();
        let store = ProfileStore::new(dir.path().to_path_buf());
        assert!(store.register(&input("a@b.de", "short")).is_err());
        for email in ["", "nope", "a@b", "a b@c.de", "a@@b.de", "a@.de"] {
            assert!(store.register(&input(email, "long enough pw")).is_err(), "{email}");
        }
        let mut no_consent = input("a@b.de", "long enough pw");
        no_consent.accept_privacy = false;
        assert!(store.register(&no_consent).is_err());
        let mut bad_phone = input("a@b.de", "long enough pw");
        bad_phone.phone = "<script>".into();
        assert!(store.register(&bad_phone).is_err());
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn onboarding_needs_every_answer() {
        let mut a = answers();
        a.goals.clear();
        assert!(a.normalised().is_err());
    }
}
