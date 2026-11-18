//! All Capital backend.
//!
//! Everything security relevant lives here: password hashing, the session and
//! all disk access. The web view only ever receives [`profiles::PublicProfile`].

mod commands;
mod devices;
mod properties;
mod profiles;
mod storage;
mod vault;
mod vehicles;

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
            commands::list_vehicles,
            commands::estimate_vehicle,
            commands::add_vehicle,
            commands::set_vehicle_value,
            commands::delete_vehicle,
            commands::add_journal_entry,
            commands::delete_journal_entry,
            commands::set_next_service,
            commands::list_properties,
            commands::add_property,
            commands::set_property_value,
            commands::delete_property,
            commands::list_devices,
            commands::estimate_device,
            commands::add_device,
            commands::set_device_value,
            commands::delete_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running All Capital");
}
