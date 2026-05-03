use anyhow::{anyhow, Result};
use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::state::AppState;

/// Register the global hotkey for hold-to-talk.
pub fn register_hotkey(app: &AppHandle, shortcut_str: &str) -> Result<()> {
    let shortcut: Shortcut = shortcut_str
        .parse()
        .map_err(|_| anyhow!("Invalid shortcut string: {}", shortcut_str))?;

    app.global_shortcut()
        .on_shortcut(shortcut, move |app_handle, _shortcut, event| {
            let app = app_handle.clone();
            let state = app_handle.state::<AppState>();

            match event.state() {
                ShortcutState::Pressed => {
                    log::info!("Shortcut PRESSED");
                    tauri::async_runtime::spawn(crate::flow::on_press(
                        app,
                        state.inner().clone(),
                    ));
                }
                ShortcutState::Released => {
                    log::info!("Shortcut RELEASED");
                    tauri::async_runtime::spawn(crate::flow::on_release(
                        app,
                        state.inner().clone(),
                    ));
                }
            }
        })
        .map_err(|e| anyhow!("Failed to register shortcut '{}': {}", shortcut_str, e))?;

    log::info!("Global shortcut registered: {}", shortcut_str);
    Ok(())
}

/// Unregister all global shortcuts
pub fn unregister_all(app: &AppHandle) -> Result<()> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|e| anyhow!("Failed to unregister shortcuts: {}", e))?;
    Ok(())
}
