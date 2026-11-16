//! All Capital backend.
//!
//! Everything security relevant lives here: password hashing, the session and
//! all disk access. The web view only ever receives [`profiles::PublicProfile`].

mod commands;
mod profiles;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            app.manage(commands::AppState::new(dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_profiles,
            commands::register,
            commands::login,
            commands::logout,
            commands::set_nickname,
            commands::save_onboarding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running All Capital");
}
