use anyhow::{anyhow, Result};
use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::models::manager;
use crate::state::WhisperModel;

/// Cached model context — loaded once, reused for all transcriptions.
static CACHED_CTX: Mutex<Option<(String, WhisperContext)>> = Mutex::new(None);

/// Pre-load a model into the cache. Called on app startup in a background thread.
pub fn preload(model: &WhisperModel) -> Result<()> {
    let model_path = manager::whisper_model_path(model)?;
    if !model_path.exists() {
        log::info!("Model not downloaded, skipping preload");
        return Ok(());
    }

    let model_path_str = model_path.to_str().ok_or_else(|| anyhow!("Invalid path"))?.to_string();
    let mut guard = CACHED_CTX.lock().map_err(|e| anyhow!("Lock failed: {}", e))?;

    if guard.is_none() {
        log::info!("Preloading Whisper model: {:?}", model_path);
        let ctx = WhisperContext::new_with_params(&model_path_str, WhisperContextParameters::default())
            .map_err(|e| anyhow!("Failed to load model: {}", e))?;
        *guard = Some((model_path_str, ctx));
        log::info!("Whisper model preloaded successfully");
    }
    Ok(())
}

/// Get or create a WhisperContext for the given model.
fn get_context(model: &WhisperModel) -> Result<std::sync::MutexGuard<'static, Option<(String, WhisperContext)>>> {
    let model_path = manager::whisper_model_path(model)?;
    if !model_path.exists() {
        return Err(anyhow!(
            "Whisper model '{}' not downloaded. Download it from Settings > Models.",
            model.display_name()
        ));
    }

    let model_path_str = model_path.to_str().ok_or_else(|| anyhow!("Invalid path"))?.to_string();
    let mut guard = CACHED_CTX.lock().map_err(|e| anyhow!("Lock failed: {}", e))?;

    let needs_load = match &*guard {
        Some((cached_path, _)) => cached_path != &model_path_str,
        None => true,
    };

    if needs_load {
        log::info!("Loading Whisper model: {:?}", model_path);
        let ctx = WhisperContext::new_with_params(&model_path_str, WhisperContextParameters::default())
            .map_err(|e| anyhow!("Failed to load model: {}", e))?;
        *guard = Some((model_path_str, ctx));
    }

    Ok(guard)
}

/// Trim leading and trailing silence from audio samples.
/// Silence = RMS below threshold for consecutive frames.
fn trim_silence(samples: &[f32], sample_rate: u32) -> &[f32] {
    let frame_size = (sample_rate as usize) / 20; // 50ms frames
    let threshold = 0.01_f32; // RMS threshold for silence

    // Find first non-silent frame
    let start = samples
        .chunks(frame_size)
        .position(|chunk| {
            let rms = (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt();
            rms > threshold
        })
        .unwrap_or(0)
        * frame_size;

    // Find last non-silent frame
    let end = samples.len()
        - samples
            .chunks(frame_size)
            .rev()
            .position(|chunk| {
                let rms = (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt();
                rms > threshold
            })
            .unwrap_or(0)
            * frame_size;

    if start >= end {
        return samples; // All silence, return original
    }

    &samples[start..end]
}

/// Transcribe audio samples using Whisper.cpp (offline).
/// Model is cached in memory. Silence is trimmed. Optimized for speed.
pub fn transcribe(samples: &[f32], model: &WhisperModel, language: &str) -> Result<String> {
    // Trim silence for faster processing
    let trimmed = trim_silence(samples, 16000);
    let trimmed_duration = trimmed.len() as f32 / 16000.0;

    if trimmed.is_empty() || trimmed_duration < 0.2 {
        return Ok(String::new()); // Too short after trimming
    }

    log::info!(
        "Audio: {:.1}s original → {:.1}s after silence trim",
        samples.len() as f32 / 16000.0,
        trimmed_duration
    );

    let guard = get_context(model)?;
    let (_, ctx) = guard.as_ref().ok_or_else(|| anyhow!("No model loaded"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

    // Language
    let lang_lower = language.to_lowercase();
    if !lang_lower.is_empty() && lang_lower != "auto" {
        params.set_language(Some(&lang_lower));
    } else {
        params.set_language(None);
    }

    // Speed optimizations
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_translate(false);
    params.set_no_context(true);
    params.set_single_segment(true);
    params.set_suppress_blank(true);
    params.set_temperature(0.0);          // No temperature fallback = faster
    params.set_temperature_inc(0.0);      // Disable temperature increment (no retries)

    // Auto-detect CPU cores
    let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(2);
    let threads = std::cmp::max(1, std::cmp::min(cores / 2, 4)) as i32;
    params.set_n_threads(threads);

    log::info!("Transcribing {:.1}s with {} threads...", trimmed_duration, threads);

    let mut state = ctx.create_state().map_err(|e| anyhow!("State creation failed: {}", e))?;

    state.full(params, trimmed).map_err(|e| anyhow!("Transcription failed: {}", e))?;

    let num_segments = state.full_n_segments().map_err(|e| anyhow!("Segments failed: {}", e))?;

    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment) = state.full_get_segment_text(i) {
            text.push_str(&segment);
        }
    }

    let filtered = text
        .trim()
        .replace("[BLANK_AUDIO]", "")
        .replace("[NO_SPEECH]", "")
        .trim()
        .to_string();

    log::info!("Result: {} chars", filtered.len());
    Ok(filtered)
}
