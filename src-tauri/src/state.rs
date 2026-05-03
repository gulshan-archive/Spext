use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Application-wide shared state
#[derive(Clone)]
pub struct AppState {
    pub recording_phase: Arc<Mutex<RecordingPhase>>,
    pub config: Arc<Mutex<SpextConfig>>,
    /// Audio capture is behind a std::sync::Mutex because cpal callbacks
    /// run on CoreAudio threads and need synchronous access.
    pub audio_capture: Arc<std::sync::Mutex<crate::audio::capture::AudioCapture>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            recording_phase: Arc::new(Mutex::new(RecordingPhase::Idle)),
            config: Arc::new(Mutex::new(SpextConfig::default())),
            audio_capture: Arc::new(std::sync::Mutex::new(
                crate::audio::capture::AudioCapture::new(),
            )),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum RecordingPhase {
    Idle,
    Recording,
    Processing,
    Success,
    Error,
}

impl Default for RecordingPhase {
    fn default() -> Self {
        Self::Idle
    }
}

/// Available Whisper.cpp model sizes (GGML format from HuggingFace)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WhisperModel {
    Tiny,
    TinyEn,
    Base,
    BaseEn,
    Small,
    SmallEn,
    Medium,
    MediumEn,
    LargeV3,
    LargeV3Turbo,
}

impl Default for WhisperModel {
    fn default() -> Self {
        Self::Base
    }
}

impl WhisperModel {
    /// HuggingFace download URL for the GGML model file
    pub fn download_url(&self) -> &str {
        match self {
            Self::Tiny => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
            Self::TinyEn => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
            Self::Base => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
            Self::BaseEn => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
            Self::Small => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
            Self::SmallEn => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
            Self::Medium => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
            Self::MediumEn => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin",
            Self::LargeV3 => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin",
            Self::LargeV3Turbo => "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin",
        }
    }

    /// Filename for the model on disk
    pub fn filename(&self) -> &str {
        match self {
            Self::Tiny => "ggml-tiny.bin",
            Self::TinyEn => "ggml-tiny.en.bin",
            Self::Base => "ggml-base.bin",
            Self::BaseEn => "ggml-base.en.bin",
            Self::Small => "ggml-small.bin",
            Self::SmallEn => "ggml-small.en.bin",
            Self::Medium => "ggml-medium.bin",
            Self::MediumEn => "ggml-medium.en.bin",
            Self::LargeV3 => "ggml-large-v3.bin",
            Self::LargeV3Turbo => "ggml-large-v3-turbo.bin",
        }
    }

    /// Human-readable display name with approximate size
    pub fn display_name(&self) -> &str {
        match self {
            Self::Tiny => "Tiny (~75 MB)",
            Self::TinyEn => "Tiny English (~75 MB)",
            Self::Base => "Base (~142 MB)",
            Self::BaseEn => "Base English (~142 MB)",
            Self::Small => "Small (~466 MB)",
            Self::SmallEn => "Small English (~466 MB)",
            Self::Medium => "Medium (~1.5 GB)",
            Self::MediumEn => "Medium English (~1.5 GB)",
            Self::LargeV3 => "Large v3 (~3.1 GB)",
            Self::LargeV3Turbo => "Large v3 Turbo (~1.6 GB)",
        }
    }

    /// List all available models
    pub fn all() -> Vec<WhisperModel> {
        vec![
            Self::Tiny,
            Self::TinyEn,
            Self::Base,
            Self::BaseEn,
            Self::Small,
            Self::SmallEn,
            Self::Medium,
            Self::MediumEn,
            Self::LargeV3,
            Self::LargeV3Turbo,
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WordReplacement {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpextConfig {
    pub shortcut: String,
    pub language: String,
    pub whisper_model: WhisperModel,
    pub smart_keywords_enabled: bool,
    pub copy_to_clipboard: bool,
    pub chime_enabled: bool,
    pub chime_volume: f32,
    pub replacements: Vec<WordReplacement>,
}

impl Default for SpextConfig {
    fn default() -> Self {
        Self {
            shortcut: "Alt+Space".to_string(),
            language: "en".to_string(),
            whisper_model: WhisperModel::Base,
            smart_keywords_enabled: false,
            copy_to_clipboard: true,
            chime_enabled: true,
            chime_volume: 0.5,
            replacements: vec![],
        }
    }
}

/// Info about a downloaded model, returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub engine: String,
    pub size_display: String,
    pub downloaded: bool,
    pub path: Option<String>,
}
