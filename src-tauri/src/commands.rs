use tauri::{AppHandle, Manager};

use crate::audio::capture::AudioCapture;
use crate::hotkey::handler;
use crate::injection;
use crate::models::manager;
use crate::state::{AppState, ModelInfo, RecordingPhase, SpextConfig, WhisperModel};

/// Update the application configuration from the frontend
#[tauri::command]
pub async fn set_config(app: AppHandle, config: SpextConfig) -> Result<(), String> {
    let state = app.state::<AppState>();
    let old_config = state.config.lock().await.clone();

    // Update config
    *state.config.lock().await = config.clone();

    // Persist to disk
    if let Err(e) = crate::config_store::save_config(&config) {
        log::error!("Failed to save config to disk: {}", e);
    }

    // Re-register hotkey if it changed
    if old_config.shortcut != config.shortcut {
        if let Err(e) = handler::unregister_all(&app) {
            log::error!("Failed to unregister old shortcut: {}", e);
        }
        if let Err(e) = handler::register_hotkey(&app, &config.shortcut) {
            log::error!("Failed to register new shortcut '{}': {}", config.shortcut, e);
            return Err(format!("Failed to register shortcut '{}': {}", config.shortcut, e));
        }
    }

    log::info!("Configuration updated");
    Ok(())
}

/// Get the current configuration
#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<SpextConfig, String> {
    let state = app.state::<AppState>();
    let config = state.config.lock().await.clone();
    Ok(config)
}

/// Get the current recording phase
#[tauri::command]
pub async fn get_recording_phase(app: AppHandle) -> Result<String, String> {
    let state = app.state::<AppState>();
    let phase = state.recording_phase.lock().await;
    let phase_str = match *phase {
        RecordingPhase::Idle => "idle",
        RecordingPhase::Recording => "recording",
        RecordingPhase::Processing => "processing",
        RecordingPhase::Success => "success",
        RecordingPhase::Error => "error",
    };
    Ok(phase_str.to_string())
}

/// List available audio input devices
#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<String>, String> {
    AudioCapture::list_devices().map_err(|e| e.to_string())
}

/// Check if accessibility permission is granted (macOS)
#[tauri::command]
pub fn check_accessibility() -> bool {
    injection::check_accessibility_permission()
}

/// Open accessibility settings (macOS)
#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    injection::open_accessibility_settings().map_err(|e| e.to_string())
}

/// List all available Whisper models with download status
#[tauri::command]
pub fn list_whisper_models() -> Vec<ModelInfo> {
    manager::list_whisper_models()
}

/// Download a Whisper model by its ID (e.g., "base", "small_en")
#[tauri::command]
pub async fn download_whisper_model(app: AppHandle, model_id: String) -> Result<String, String> {
    let model: WhisperModel =
        serde_json::from_str(&format!("\"{}\"", model_id)).map_err(|e| {
            format!(
                "Invalid Whisper model ID '{}': {}. Valid IDs: tiny, tiny_en, base, base_en, small, small_en, medium, medium_en, large_v3, large_v3_turbo",
                model_id, e
            )
        })?;

    let path = manager::download_whisper_model(&app, &model)
        .await
        .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

/// Delete a downloaded Whisper model
#[tauri::command]
pub fn delete_whisper_model_cmd(model_id: String) -> Result<(), String> {
    let model: WhisperModel =
        serde_json::from_str(&format!("\"{}\"", model_id)).map_err(|e| e.to_string())?;
    manager::delete_whisper_model(&model).map_err(|e| e.to_string())
}

/// Detect smart keywords in text
#[tauri::command]
pub fn detect_keywords(text: String) -> Option<crate::keywords::detector::KeywordMatch> {
    crate::keywords::detector::detect(&text)
}

/// Manually inject text into the frontmost application
#[tauri::command]
pub async fn inject_text(text: String) -> Result<(), String> {
    injection::inject_text(&text).await.map_err(|e| e.to_string())
}

/// Get all history entries
#[tauri::command]
pub fn get_history() -> Result<Vec<crate::history_store::HistoryEntry>, String> {
    let data = crate::history_store::load_history();
    Ok(data.entries)
}

/// Add a history entry
#[tauri::command]
pub fn add_history_entry(
    id: String,
    text: String,
    original_text: String,
    language: String,
    timestamp: String,
    duration_secs: f32,
) -> Result<(), String> {
    crate::history_store::add_entry(crate::history_store::HistoryEntry {
        id,
        text,
        original_text,
        language,
        timestamp,
        duration_secs,
    })
    .map_err(|e| e.to_string())
}

/// Delete a single history entry
#[tauri::command]
pub fn delete_history_entry(id: String) -> Result<(), String> {
    crate::history_store::delete_entry(&id).map_err(|e| e.to_string())
}

/// Clear all history
#[tauri::command]
pub fn clear_history() -> Result<(), String> {
    crate::history_store::clear_all().map_err(|e| e.to_string())
}
