mod audio;
mod commands;
mod config_store;
mod flow;
mod history_store;
mod hotkey;
mod injection;
mod keywords;
mod models;
mod state;
mod transcription;

use state::AppState;
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            commands::set_config,
            commands::get_config,
            commands::get_recording_phase,
            commands::list_audio_devices,
            commands::check_accessibility,
            commands::open_accessibility_settings,
            commands::list_whisper_models,
            commands::download_whisper_model,
            commands::delete_whisper_model_cmd,
            commands::detect_keywords,
            commands::inject_text,
            commands::get_history,
            commands::add_history_entry,
            commands::delete_history_entry,
            commands::clear_history,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            let saved_config = config_store::load_config();
            tauri::async_runtime::block_on(async {
                *app_state.config.lock().await = saved_config;
            });

            let config =
                tauri::async_runtime::block_on(async { app_state.config.lock().await.clone() });

            if let Err(e) = hotkey::handler::register_hotkey(&handle, &config.shortcut) {
                log::error!("Failed to register hotkey: {}", e);
            }

            setup_tray(app)?;

            log::info!("Spext initialized (offline mode)");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running spext");
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{MenuBuilder, MenuItemBuilder},
        tray::TrayIconBuilder,
        Manager,
    };

    let show = MenuItemBuilder::with_id("show", "Show Spext").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&settings)
        .separator()
        .item(&quit)
        .build()?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Spext — Offline Speech to Text")
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate", "/settings");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
