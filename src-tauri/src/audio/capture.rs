use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::Stream;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

/// cpal::Stream is not Send on macOS (CoreAudio manages thread affinity).
/// We wrap it to allow storage in shared state. The Mutex provides exclusive access.
struct SendStream(Stream);
unsafe impl Send for SendStream {}
unsafe impl Sync for SendStream {}

/// Shared audio capture that can be started/stopped from different async tasks.
/// Stored in AppState so on_press can start it and on_release can stop it.
pub struct AudioCapture {
    stream: Option<SendStream>,
    pub buffer: Arc<Mutex<Vec<f32>>>,
    pub sample_rate: u32,
}

impl AudioCapture {
    pub fn new() -> Self {
        Self {
            stream: None,
            buffer: Arc::new(Mutex::new(Vec::new())),
            sample_rate: 16000,
        }
    }

    /// Start capturing audio from the default input device.
    /// Emits `audio-level` events with RMS values for the waveform visualizer.
    pub fn start(&mut self, app: AppHandle) -> Result<()> {
        // Stop any existing stream first
        self.stream = None;

        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .ok_or_else(|| anyhow!("No input device available"))?;

        log::info!("Using input device: {}", device.name().unwrap_or_default());

        // Use the device's default input config for reliability
        let default_cfg = device.default_input_config()?;
        let use_rate = default_cfg.sample_rate().0;
        let channels = default_cfg.channels();
        self.sample_rate = use_rate;

        log::info!("Using device config: {}Hz, {} channel(s)", use_rate, channels);

        let config = cpal::StreamConfig {
            channels,
            sample_rate: cpal::SampleRate(use_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        let buffer = self.buffer.clone();
        let app_for_level = app.clone();
        let num_channels = channels as usize;

        // Clear previous buffer
        if let Ok(mut buf) = self.buffer.lock() {
            buf.clear();
        }

        let stream = device.build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                // Convert multi-channel to mono by averaging
                let mono: Vec<f32> = if num_channels > 1 {
                    data.chunks(num_channels)
                        .map(|frame| frame.iter().sum::<f32>() / num_channels as f32)
                        .collect()
                } else {
                    data.to_vec()
                };

                if let Ok(mut buf) = buffer.lock() {
                    buf.extend_from_slice(&mono);
                }
                // Calculate RMS for waveform visualizer
                if !mono.is_empty() {
                    let rms =
                        (mono.iter().map(|s| s * s).sum::<f32>() / mono.len() as f32).sqrt();
                    let _ = app_for_level.emit("audio-level", rms);
                }
            },
            |err| log::error!("Audio capture error: {}", err),
            None,
        )?;

        stream.play()?;
        self.stream = Some(SendStream(stream));

        log::info!("Audio capture started at {}Hz", use_rate);
        Ok(())
    }

    /// Stop capturing and return the recorded audio samples + sample rate.
    pub fn stop(&mut self) -> (Vec<f32>, u32) {
        // Drop the stream to stop recording
        self.stream = None;

        let samples = if let Ok(mut buf) = self.buffer.lock() {
            let data = std::mem::take(&mut *buf);
            data
        } else {
            Vec::new()
        };

        let duration = if self.sample_rate > 0 {
            samples.len() as f32 / self.sample_rate as f32
        } else {
            0.0
        };
        log::info!(
            "Audio capture stopped. Duration: {:.1}s, Samples: {}, Rate: {}Hz",
            duration,
            samples.len(),
            self.sample_rate
        );

        (samples, self.sample_rate)
    }

    /// List available input devices
    pub fn list_devices() -> Result<Vec<String>> {
        let host = cpal::default_host();
        let devices: Vec<String> = host
            .input_devices()?
            .filter_map(|d| d.name().ok())
            .collect();
        Ok(devices)
    }
}
