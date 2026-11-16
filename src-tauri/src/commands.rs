//! Tauri commands: the complete surface the web view can reach.

use crate::profiles::{derive_key, Onboarding, ProfileStore, PublicProfile, RegisterInput};
use crate::storage::{current_year, now_secs};
use crate::vault::{Vault, VaultData, VaultKey};
use crate::vehicles::{
    check_value, estimate, EstimateResult, ValuePoint, ValueSource, Vehicle, VehicleDraft, VehicleView, MAX_VEHICLES,
};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;
use zeroize::{Zeroize, Zeroizing};

const FREE_ATTEMPTS: u32 = 3;
const MAX_LOCK_SECS: u64 = 300;

#[derive(Default)]
struct Throttle {
    failures: u32,
    locked_until: Option<Instant>,
}

impl Throttle {
    fn remaining(&self, now: Instant) -> Option<Duration> {
        self.locked_until.and_then(|until| until.checked_duration_since(now)).filter(|d| !d.is_zero())
    }

    /// After three free attempts the wait doubles each time: 2 s, 4 s, … capped at 5 min.
    fn fail(&mut self, now: Instant) {
        self.failures = self.failures.saturating_add(1);
        if self.failures >= FREE_ATTEMPTS {
            let exp = (self.failures - FREE_ATTEMPTS + 1).min(16);
            let secs = (1u64 << exp).min(MAX_LOCK_SECS);
            self.locked_until = Some(now + Duration::from_secs(secs));
        }
    }
}

/// An unlocked profile. Lives in memory only; the key is wiped on drop.
#[derive(Clone)]
struct Session {
    profile_id: String,
    key: VaultKey,
}

pub struct AppState {
    /// Guards every read-modify-write of the profile file.
    store: Mutex<ProfileStore>,
    /// Guards every read-modify-write of a vault file.
    vault: Mutex<Vault>,
    session: Mutex<Option<Session>>,
    throttle: Mutex<Throttle>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            store: Mutex::new(ProfileStore::new(data_dir.clone())),
            vault: Mutex::new(Vault::new(data_dir)),
            session: Mutex::new(None),
            throttle: Mutex::new(Throttle::default()),
        }
    }

    fn session(&self) -> Result<Session, String> {
        lock(&self.session).clone().ok_or_else(|| "Nicht angemeldet.".to_string())
    }

    fn session_id(&self) -> Result<String, String> {
        self.session().map(|s| s.profile_id)
    }

    /// Derives the vault key and opens the session.
    fn unlock(&self, profile: &PublicProfile, password: &str) -> Result<(), String> {
        let salt = lock(&self.store).vault_salt(&profile.id)?;
        let key = Zeroizing::new(derive_key(password, &salt)?);
        // Fail now rather than on first use if the vault cannot be opened.
        lock(&self.vault).load(&profile.id, &key)?;
        *lock(&self.session) = Some(Session { profile_id: profile.id.clone(), key });
        Ok(())
    }

    /// Runs one read-modify-write on the unlocked vault.
    fn with_vault<T>(&self, change: impl FnOnce(&mut VaultData) -> Result<T, String>) -> Result<T, String> {
        let session = self.session()?;
        let vault = lock(&self.vault);
        let mut data = vault.load(&session.profile_id, &session.key)?;
        let out = change(&mut data)?;
        vault.save(&session.profile_id, &session.key, &data)?;
        Ok(out)
    }
}

/// A poisoned lock only means another command panicked; the data is still usable.
fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[tauri::command(async)]
pub fn list_profiles(state: State<'_, AppState>) -> Result<Vec<PublicProfile>, String> {
    lock(&state.store).list()
}

#[tauri::command(async)]
pub fn register(state: State<'_, AppState>, mut input: RegisterInput) -> Result<PublicProfile, String> {
    let created = lock(&state.store).register(&input);
    let result = created.and_then(|profile| state.unlock(&profile, &input.password).map(|()| profile));
    input.password.zeroize();
    result
}

#[tauri::command(async)]
pub fn login(state: State<'_, AppState>, email: String, password: String) -> Result<PublicProfile, String> {
    let password = Zeroizing::new(password);
    if let Some(wait) = lock(&state.throttle).remaining(Instant::now()) {
        return Err(format!("Zu viele Fehlversuche. Bitte warte {} Sekunden.", wait.as_secs().max(1)));
    }
    let result = lock(&state.store).verify(&email, &password);
    match &result {
        Ok(_) => *lock(&state.throttle) = Throttle::default(),
        Err(_) => lock(&state.throttle).fail(Instant::now()),
    }
    let profile = result?;
    state.unlock(&profile, &password)?;
    Ok(profile)
}

#[tauri::command(async)]
pub fn logout(state: State<'_, AppState>) {
    *lock(&state.session) = None;
}

#[tauri::command(async)]
pub fn set_nickname(state: State<'_, AppState>, nickname: String) -> Result<PublicProfile, String> {
    let id = state.session_id()?;
    lock(&state.store).set_nickname(&id, &nickname)
}

#[tauri::command(async)]
pub fn save_onboarding(state: State<'_, AppState>, answers: Onboarding) -> Result<PublicProfile, String> {
    let id = state.session_id()?;
    lock(&state.store).save_onboarding(&id, answers)
}

#[tauri::command(async)]
pub fn list_vehicles(state: State<'_, AppState>) -> Result<Vec<VehicleView>, String> {
    let session = state.session()?;
    let data = lock(&state.vault).load(&session.profile_id, &session.key)?;
    let year = current_year();
    Ok(data.vehicles.into_iter().map(|v| VehicleView::new(v, year)).collect())
}

/// Pure calculation; nothing is stored.
#[tauri::command(async)]
pub fn estimate_vehicle(state: State<'_, AppState>, draft: VehicleDraft) -> Result<EstimateResult, String> {
    state.session()?;
    let year = current_year();
    let draft = draft.validated(year)?;
    Ok(estimate(&draft, year).into())
}

#[tauri::command(async)]
pub fn add_vehicle(
    state: State<'_, AppState>,
    draft: VehicleDraft,
    value_cents: i64,
    source: ValueSource,
) -> Result<VehicleView, String> {
    let year = current_year();
    let draft = draft.validated(year)?;
    let cents = check_value(value_cents)?;
    let now = now_secs();
    let vehicle = Vehicle {
        id: uuid::Uuid::new_v4().to_string(),
        draft,
        created_at: now,
        history: vec![ValuePoint { at: now, cents, source }],
    };
    state.with_vault(|data| {
        if data.vehicles.len() >= MAX_VEHICLES {
            return Err("Die maximale Anzahl an Fahrzeugen ist erreicht.".into());
        }
        data.vehicles.push(vehicle.clone());
        Ok(())
    })?;
    Ok(VehicleView::new(vehicle, year))
}

/// Records a new manually entered value. Earlier values stay in the history.
#[tauri::command(async)]
pub fn set_vehicle_value(state: State<'_, AppState>, id: String, value_cents: i64) -> Result<VehicleView, String> {
    let cents = check_value(value_cents)?;
    let vehicle = state.with_vault(|data| {
        let v = data.vehicles.iter_mut().find(|v| v.id == id).ok_or("Fahrzeug nicht gefunden.")?;
        v.history.push(ValuePoint { at: now_secs(), cents, source: ValueSource::Manual });
        // Keep the file bounded: drop the oldest points beyond 1,000.
        let excess = v.history.len().saturating_sub(1000);
        v.history.drain(..excess);
        Ok(v.clone())
    })?;
    Ok(VehicleView::new(vehicle, current_year()))
}

#[tauri::command(async)]
pub fn delete_vehicle(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.with_vault(|data| {
        let before = data.vehicles.len();
        data.vehicles.retain(|v| v.id != id);
        if data.vehicles.len() == before { Err("Fahrzeug nicht gefunden.".into()) } else { Ok(()) }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn throttle_backs_off_exponentially() {
        let now = Instant::now();
        let mut t = Throttle::default();
        t.fail(now);
        t.fail(now);
        assert!(t.remaining(now).is_none());
        t.fail(now);
        assert_eq!(t.remaining(now).unwrap().as_secs(), 2);
        t.fail(now);
        assert_eq!(t.remaining(now).unwrap().as_secs(), 4);
        for _ in 0..40 {
            t.fail(now);
        }
        assert_eq!(t.remaining(now).unwrap().as_secs(), MAX_LOCK_SECS);
        assert!(t.remaining(now + Duration::from_secs(MAX_LOCK_SECS)).is_none());
    }
}
