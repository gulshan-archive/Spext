use anyhow::{anyhow, Result};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

use crate::models::manager;
use crate::state::WhisperModel;

/// Transcribe audio samples using Whisper.cpp (offline).
/// `samples` must be f32 PCM at 16kHz mono.
pub fn transcribe(samples: &[f32], model: &WhisperModel, language: &str) -> Result<String> {
    let model_path = manager::whisper_model_path(model)?;

    if !model_path.exists() {
        return Err(anyhow!(
            "Whisper model '{}' not downloaded. Please download it from Settings > Models.",
            model.display_name()
        ));
    }

    let model_path_str = model_path
        .to_str()
        .ok_or_else(|| anyhow!("Invalid model path"))?;

    log::info!("Loading Whisper model from {:?}", model_path);

    let ctx = WhisperContext::new_with_params(model_path_str, WhisperContextParameters::default())
        .map_err(|e| anyhow!("Failed to load Whisper model: {}", e))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });

    // Set language (empty string = auto-detect)
    let lang_lower = language.to_lowercase();
    log::info!("Language setting: '{}' (lowered: '{}')", language, lang_lower);
    if !lang_lower.is_empty() && lang_lower != "auto" {
        log::info!("Setting Whisper language to: {}", lang_lower);
        params.set_language(Some(&lang_lower));
    } else {
        log::info!("Using auto language detection");
        params.set_language(None);
    }

    // Optimize for real-time dictation
    params.set_print_special(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_translate(false);
    params.set_no_context(true);
    params.set_single_segment(false);
    params.set_suppress_blank(true);

    // Use 4 threads for processing
    params.set_n_threads(4);

    log::info!(
        "Transcribing {} samples ({:.1}s) with Whisper.cpp...",
        samples.len(),
        samples.len() as f32 / 16000.0
    );

    let mut state = ctx.create_state().map_err(|e| anyhow!("Failed to create Whisper state: {}", e))?;

    state
        .full(params, samples)
        .map_err(|e| anyhow!("Whisper transcription failed: {}", e))?;

    let num_segments = state.full_n_segments().map_err(|e| anyhow!("Failed to get segments: {}", e))?;

    let mut text = String::new();
    for i in 0..num_segments {
        if let Ok(segment) = state.full_get_segment_text(i) {
            text.push_str(&segment);
        }
    }

    let result = text.trim().to_string();
    log::info!("Whisper transcription result: {} chars", result.len());

    // Filter out Whisper's special tokens that indicate no speech
    let filtered = result
        .replace("[BLANK_AUDIO]", "")
        .replace("[NO_SPEECH]", "")
        .trim()
        .to_string();

    Ok(filtered)
}
