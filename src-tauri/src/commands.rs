//! Tauri commands: the complete surface the web view can reach.

use crate::profiles::{Onboarding, ProfileStore, PublicProfile, RegisterInput};
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

pub struct AppState {
    /// Guards every read-modify-write of the profile file.
    store: Mutex<ProfileStore>,
    /// Id of the unlocked profile. Lives in memory only.
    session: Mutex<Option<String>>,
    throttle: Mutex<Throttle>,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            store: Mutex::new(ProfileStore::new(data_dir)),
            session: Mutex::new(None),
            throttle: Mutex::new(Throttle::default()),
        }
    }

    fn session_id(&self) -> Result<String, String> {
        lock(&self.session).clone().ok_or_else(|| "Nicht angemeldet.".to_string())
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
    let result = lock(&state.store).register(&input);
    input.password.zeroize();
    if let Ok(profile) = &result {
        *lock(&state.session) = Some(profile.id.clone());
    }
    result
}

#[tauri::command(async)]
pub fn login(state: State<'_, AppState>, email: String, password: String) -> Result<PublicProfile, String> {
    let password = Zeroizing::new(password);
    if let Some(wait) = lock(&state.throttle).remaining(Instant::now()) {
        return Err(format!("Zu viele Fehlversuche. Bitte warte {} Sekunden.", wait.as_secs().max(1)));
    }
    let result = lock(&state.store).verify(&email, &password);
    let mut throttle = lock(&state.throttle);
    match &result {
        Ok(profile) => {
            *throttle = Throttle::default();
            *lock(&state.session) = Some(profile.id.clone());
        }
        Err(_) => throttle.fail(Instant::now()),
    }
    result
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
