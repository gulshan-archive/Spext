use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use crate::state::{ModelInfo, WhisperModel};

/// Get the base directory for storing models.
/// Uses the app's data directory: ~/Library/Application Support/com.gulshanyadav.spext/models/
pub fn models_dir() -> Result<PathBuf> {
    let data_dir = dirs::data_dir().ok_or_else(|| anyhow!("Cannot determine data directory"))?;
    let dir = data_dir.join("com.gulshanyadav.spext").join("models");
    Ok(dir)
}

/// Get the directory for Whisper models
pub fn whisper_models_dir() -> Result<PathBuf> {
    Ok(models_dir()?.join("whisper"))
}

/// Get the full path to a Whisper model file
pub fn whisper_model_path(model: &WhisperModel) -> Result<PathBuf> {
    Ok(whisper_models_dir()?.join(model.filename()))
}

/// Check if a Whisper model is downloaded
pub fn is_whisper_downloaded(model: &WhisperModel) -> bool {
    whisper_model_path(model)
        .map(|p| p.exists())
        .unwrap_or(false)
}

/// List all Whisper models with their download status
pub fn list_whisper_models() -> Vec<ModelInfo> {
    WhisperModel::all()
        .into_iter()
        .map(|m| {
            let downloaded = is_whisper_downloaded(&m);
            let path = if downloaded {
                whisper_model_path(&m).ok().map(|p| p.to_string_lossy().to_string())
            } else {
                None
            };
            ModelInfo {
                id: serde_json::to_string(&m).unwrap_or_default().trim_matches('"').to_string(),
                name: m.display_name().to_string(),
                engine: "whisper_cpp".to_string(),
                size_display: m.display_name().to_string(),
                downloaded,
                path,
            }
        })
        .collect()
}

/// Download a Whisper model from HuggingFace.
/// Emits `model-download-progress` events with { model_id, progress (0-100) }.
pub async fn download_whisper_model(app: &AppHandle, model: &WhisperModel) -> Result<PathBuf> {
    let dir = whisper_models_dir()?;
    std::fs::create_dir_all(&dir)?;

    let dest = dir.join(model.filename());
    let url = model.download_url();
    let model_id = serde_json::to_string(model)
        .unwrap_or_default()
        .trim_matches('"')
        .to_string();

    log::info!("Downloading Whisper model {} from {}", model_id, url);

    download_file(app, url, &dest, &model_id).await?;

    log::info!("Whisper model {} downloaded to {:?}", model_id, dest);
    Ok(dest)
}

/// Delete a downloaded Whisper model
pub fn delete_whisper_model(model: &WhisperModel) -> Result<()> {
    let path = whisper_model_path(model)?;
    if path.exists() {
        std::fs::remove_file(&path)?;
    }
    Ok(())
}

/// Download a file with progress reporting
async fn download_file(app: &AppHandle, url: &str, dest: &Path, model_id: &str) -> Result<()> {
    let client = reqwest::Client::new();
    let resp = client.get(url).send().await?;

    if !resp.status().is_success() {
        return Err(anyhow!(
            "Download failed with status: {}",
            resp.status()
        ));
    }

    let total_size = resp.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut stream = resp.bytes_stream();

    let mut file = tokio::fs::File::create(dest).await?;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;

        if total_size > 0 {
            let progress = (downloaded as f64 / total_size as f64 * 100.0) as u32;
            let _ = app.emit(
                "model-download-progress",
                serde_json::json!({
                    "model_id": model_id,
                    "progress": progress,
                    "downloaded_bytes": downloaded,
                    "total_bytes": total_size,
                    "status": "downloading"
                }),
            );
        }
    }

    file.flush().await?;

    let _ = app.emit(
        "model-download-progress",
        serde_json::json!({ "model_id": model_id, "progress": 100, "status": "complete" }),
    );

    Ok(())
}

