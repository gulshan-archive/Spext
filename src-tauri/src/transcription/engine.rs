use anyhow::Result;

use crate::state::SpextConfig;

/// Transcribe audio samples using Whisper.cpp.
/// `samples` must be f32 PCM at 16kHz mono.
pub fn transcribe(samples: &[f32], config: &SpextConfig) -> Result<String> {
    super::whisper::transcribe(samples, &config.whisper_model, &config.language)
}
