use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

use crate::injection;
use crate::keywords::detector;
use crate::state::{AppState, RecordingPhase};
use crate::transcription::engine;

static CAPTURE_READY: AtomicBool = AtomicBool::new(false);

pub async fn on_press(app: AppHandle, state: AppState) {
    {
        let phase = state.recording_phase.lock().await;
        if *phase != RecordingPhase::Idle {
            return;
        }
    }

    CAPTURE_READY.store(false, Ordering::SeqCst);

    {
        let mut phase = state.recording_phase.lock().await;
        *phase = RecordingPhase::Recording;
    }

    let start_result = state
        .audio_capture
        .lock()
        .map(|mut cap| cap.start(app.clone()))
        .map_err(|e| e.to_string());

    match start_result {
        Ok(Ok(())) => {
            log::info!("Audio capture started");
            CAPTURE_READY.store(true, Ordering::SeqCst);
            let _ = app.emit("recording-started", ());
        }
        Ok(Err(e)) => {
            log::error!("Failed to start audio capture: {}", e);
            let _ = app.emit("recording-error", e.to_string());
            let mut phase = state.recording_phase.lock().await;
            *phase = RecordingPhase::Idle;
        }
        Err(e) => {
            log::error!("Failed to lock audio capture: {}", e);
            let _ = app.emit("recording-error", "Audio lock failed".to_string());
            let mut phase = state.recording_phase.lock().await;
            *phase = RecordingPhase::Idle;
        }
    }
}

pub async fn on_release(app: AppHandle, state: AppState) {
    for _ in 0..50 {
        if CAPTURE_READY.load(Ordering::SeqCst) {
            break;
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(20)).await;
    }

    {
        let phase = state.recording_phase.lock().await;
        if *phase != RecordingPhase::Recording {
            return;
        }
    }

    {
        let mut phase = state.recording_phase.lock().await;
        *phase = RecordingPhase::Processing;
    }
    let _ = app.emit("processing-started", ());

    let stop_result = state
        .audio_capture
        .lock()
        .map(|mut cap| cap.stop())
        .map_err(|e| e.to_string());

    CAPTURE_READY.store(false, Ordering::SeqCst);

    let (samples, sample_rate) = match stop_result {
        Ok(result) => result,
        Err(e) => {
            log::error!("Audio stop failed: {}", e);
            let _ = app.emit("recording-error", "Internal error".to_string());
            let mut phase = state.recording_phase.lock().await;
            *phase = RecordingPhase::Idle;
            return;
        }
    };

    let duration = if sample_rate > 0 {
        samples.len() as f32 / sample_rate as f32
    } else {
        0.0
    };

    if samples.is_empty() || duration < 0.3 {
        let _ = app.emit("recording-error", "Recording too short.".to_string());
        let mut phase = state.recording_phase.lock().await;
        *phase = RecordingPhase::Idle;
        return;
    }

    let samples_16k = if sample_rate != 16000 {
        resample(&samples, sample_rate, 16000)
    } else {
        samples
    };

    let config = state.config.lock().await.clone();

    let text = match tauri::async_runtime::spawn_blocking(move || {
        engine::transcribe(&samples_16k, &config)
    })
    .await
    {
        Ok(Ok(text)) => text,
        Ok(Err(e)) => {
            log::error!("Transcription failed: {}", e);
            let _ = app.emit("recording-error", e.to_string());
            let mut phase = state.recording_phase.lock().await;
            *phase = RecordingPhase::Idle;
            return;
        }
        Err(e) => {
            log::error!("Transcription panicked: {}", e);
            let _ = app.emit("recording-error", "Transcription failed".to_string());
            let mut phase = state.recording_phase.lock().await;
            *phase = RecordingPhase::Idle;
            return;
        }
    };

    if text.trim().is_empty() {
        let _ = app.emit("recording-error", "No speech detected.".to_string());
        let mut phase = state.recording_phase.lock().await;
        *phase = RecordingPhase::Idle;
        return;
    }

    log::info!("Transcription: '{}'", text);

    let config = state.config.lock().await.clone();
    let mut final_text = if config.smart_keywords_enabled {
        if let Some(kw) = detector::detect(&text) {
            let _ = app.emit("processing-ai", &kw.action);
            kw.clean_text
        } else {
            text.clone()
        }
    } else {
        text.clone()
    };

    // Apply word replacements
    for rule in &config.replacements {
        if !rule.from.is_empty() {
            let lower = final_text.to_lowercase();
            let pattern = rule.from.to_lowercase();
            let mut result = String::new();
            let mut start = 0;
            while let Some(pos) = lower[start..].find(&pattern) {
                let abs = start + pos;
                result.push_str(&final_text[start..abs]);
                result.push_str(&rule.to);
                start = abs + rule.from.len();
            }
            result.push_str(&final_text[start..]);
            final_text = result;
        }
    }

    // Inject text at cursor (saves/restores clipboard)
    if let Err(e) = injection::inject_text(&final_text).await {
        log::error!("Text injection failed: {}", e);
        let _ = app.emit("recording-error", e.to_string());
        let mut phase = state.recording_phase.lock().await;
        *phase = RecordingPhase::Idle;
        return;
    }

    let _ = app.emit("recording-success", &final_text);

    // Save to history
    let entry_id = format!("{}", chrono::Utc::now().timestamp_millis());
    let _ = crate::history_store::add_entry(crate::history_store::HistoryEntry {
        id: entry_id,
        text: final_text.clone(),
        original_text: text.clone(),
        language: config.language.clone(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        duration_secs: duration,
    });

    let _ = app.emit("save-history", serde_json::json!({
        "text": final_text,
        "original_text": text,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    }));

    let mut phase = state.recording_phase.lock().await;
    *phase = RecordingPhase::Idle;
}

fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || samples.is_empty() {
        return samples.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let new_len = (samples.len() as f64 / ratio) as usize;
    let mut result = Vec::with_capacity(new_len);
    for i in 0..new_len {
        let src = i as f64 * ratio;
        let idx = src as usize;
        let frac = src - idx as f64;
        if idx + 1 < samples.len() {
            result.push((samples[idx] as f64 * (1.0 - frac) + samples[idx + 1] as f64 * frac) as f32);
        } else if idx < samples.len() {
            result.push(samples[idx]);
        }
    }
    result
}
