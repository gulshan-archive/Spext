use anyhow::{anyhow, Result};
use std::sync::Mutex;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::models::manager;
use crate::state::WhisperModel;

/// Cached model context — loaded once, reused for all transcriptions.
/// The tuple stores (model_path_string, WhisperContext).
static CACHED_CTX: Mutex<Option<(String, WhisperContext)>> = Mutex::new(None);

/// Get or create a WhisperContext for the given model.
/// Reuses the cached context if the same model is requested.
fn get_context(model: &WhisperModel) -> Result<std::sync::MutexGuard<'static, Option<(String, WhisperContext)>>> {
    let model_path = manager::whisper_model_path(model)?;

    if !model_path.exists() {
        return Err(anyhow!(
            "Whisper model '{}' not downloaded. Please download it from Settings > Models.",
            model.display_name()
        ));
    }

    let model_path_str = model_path
        .to_str()
        .ok_or_else(|| anyhow!("Invalid model path"))?
        .to_string();

    let mut guard = CACHED_CTX.lock().map_err(|e| anyhow!("Cache lock failed: {}", e))?;

    // Check if we need to load a new model
    let needs_load = match &*guard {
        Some((cached_path, _)) => cached_path != &model_path_str,
        None => true,
    };

    if needs_load {
        log::info!("Loading Whisper model from {:?} (first time or model changed)", model_path);
        let ctx = WhisperContext::new_with_params(&model_path_str, WhisperContextParameters::default())
            .map_err(|e| anyhow!("Failed to load Whisper model: {}", e))?;
        *guard = Some((model_path_str, ctx));
        log::info!("Whisper model loaded and cached");
    } else {
        log::info!("Using cached Whisper model");
    }

    Ok(guard)
}

/// Transcribe audio samples using Whisper.cpp (offline).
/// `samples` must be f32 PCM at 16kHz mono.
/// The model is loaded once and cached for subsequent calls.
pub fn transcribe(samples: &[f32], model: &WhisperModel, language: &str) -> Result<String> {
    let guard = get_context(model)?;
    let (_, ctx) = guard.as_ref().ok_or_else(|| anyhow!("No model loaded"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

    // Set language
    let lang_lower = language.to_lowercase();
    if !lang_lower.is_empty() && lang_lower != "auto" {
        params.set_language(Some(&lang_lower));
    } else {
        params.set_language(None);
    }

    // Optimize for speed
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_translate(false);
    params.set_no_context(true);
    params.set_single_segment(true);  // Single segment = faster for short dictation
    params.set_suppress_blank(true);

    // Auto-detect CPU cores, use half (leave some for the OS)
    let cores = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(2);
    let threads = std::cmp::max(1, std::cmp::min(cores / 2, 4)) as i32;
    params.set_n_threads(threads);

    log::info!(
        "Transcribing {:.1}s audio with {} threads...",
        samples.len() as f32 / 16000.0,
        threads
    );

    let mut state = ctx.create_state().map_err(|e| anyhow!("Failed to create state: {}", e))?;

    state
        .full(params, samples)
        .map_err(|e| anyhow!("Transcription failed: {}", e))?;

    let num_segments = state.full_n_segments().map_err(|e| anyhow!("Failed to get segments: {}", e))?;

    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment) = state.full_get_segment_text(i) {
            text.push_str(&segment);
        }
    }

    let result = text.trim().to_string();
    log::info!("Transcription: {} chars", result.len());

    // Filter out special tokens
    let filtered = result
        .replace("[BLANK_AUDIO]", "")
        .replace("[NO_SPEECH]", "")
        .trim()
        .to_string();

    Ok(filtered)
}
