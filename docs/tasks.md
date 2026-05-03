# Implementation Plan: Spext — Offline Speech to Text

## Overview

Implement the Tauri 2.0 + React + TypeScript cross-platform offline speech-to-text application. The app uses Whisper.cpp for transcription, supports macOS/Windows/Linux, persists config and history to JSON files, and features a polished dark-themed UI with audio chime feedback, word replacements, and clipboard preservation during text injection.

## Tasks

- [x] 1. Project scaffolding and dependencies
  - Create Tauri 2.0 project with React + TypeScript template via `create-tauri-app`
  - Install frontend dependencies: react-router-dom, zustand, zod, framer-motion, tailwindcss, lucide-react, @tauri-apps/api, @tauri-apps/plugin-os
  - Install Tauri plugin JS bindings: global-shortcut, os, process, log (4 plugins only)
  - Configure `Cargo.toml` with Rust dependencies: tauri (tray-icon, macos-private-api), cpal, whisper-rs, reqwest (stream), chrono, futures-util, dirs, anyhow, tokio, serde, serde_json, log
  - Configure `tauri.conf.json` with window settings (900×650, min 700×500, centered), tray icon, bundle config
  - Configure `capabilities/default.json` with plugin permissions (core:default, global-shortcut, os, process, log)
  - Set up Vite config with Tailwind CSS 4 plugin
  - Set up global CSS with dark navy theme color tokens (single theme, no light mode)
  - Install cmake (build dependency for whisper-rs-sys)
  - _Requirements: 15.4, 15.5, 15.7_

- [x] 2. Rust backend — State and data models
  - Define `AppState` with `Arc<Mutex<RecordingPhase>>`, `Arc<Mutex<SpextConfig>>`, and `Arc<std::sync::Mutex<AudioCapture>>` in `state.rs`
  - Define `RecordingPhase` enum (Idle, Recording, Processing, Success, Error)
  - Define `WhisperModel` enum with 10 variants, each providing `download_url()`, `filename()`, `display_name()`
  - Define `WordReplacement` struct with `from` and `to` fields
  - Define `SpextConfig` struct with shortcut, language, whisper_model, smart_keywords_enabled, copy_to_clipboard, replacements
  - Define `ModelInfo` struct for frontend communication
  - _Requirements: 3.1, 4.1, 10.4, 15.3_

- [x] 3. Rust backend — Audio capture module
  - Implement `AudioCapture` struct in `audio/capture.rs` wrapping cpal
  - Implement `start()` to open default input device, write to shared buffer, emit `audio-level` RMS events
  - Implement `stop()` to drop stream and return accumulated samples with sample rate
  - Implement `list_devices()` to enumerate input devices
  - Implement `SendStream` wrapper for macOS CoreAudio thread safety
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Rust backend — Whisper.cpp transcription engine
  - Implement `transcription/whisper.rs` using whisper-rs
  - Load GGML model from local path, create WhisperContext and WhisperState
  - Configure FullParams: greedy sampling, 4 threads, no timestamps, suppress blanks, optional language
  - Run `state.full(params, samples)`, concatenate segment texts
  - Return error if model file not found or inference fails
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 5. Rust backend — Transcription engine dispatcher
  - Implement `transcription/engine.rs` with `transcribe()` function
  - Route to Whisper.cpp engine based on config
  - _Requirements: 3.1, 3.8_

- [x] 6. Rust backend — Model manager
  - Implement `models/manager.rs` with model directory management
  - Implement `models_dir()`, `whisper_model_path()` path functions
  - Implement `is_whisper_downloaded()` status check
  - Implement `list_whisper_models()` returning Vec<ModelInfo>
  - Implement `download_whisper_model()` with streaming download and progress events
  - Implement `delete_whisper_model()` for cleanup
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 7. Rust backend — Smart keyword detector
  - Implement `keywords/detector.rs` with `detect()` function
  - Define trigger verb table (longest-first matching, case-insensitive)
  - Define known format targets table
  - Return `KeywordMatch` with action, format, clean_text — or None
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 8. Rust backend — Cross-platform text injection
  - Implement `injection/mod.rs` with cross-platform dispatch using `#[cfg(target_os)]`
  - Implement `injection/macos.rs`: pbcopy/pbpaste + osascript Cmd+V, clipboard save/restore
  - Implement `injection/windows.rs`: PowerShell Set-Clipboard/Get-Clipboard + SendKeys Ctrl+V, clipboard save/restore
  - Implement `injection/linux.rs`: xclip/xsel + xdotool Ctrl+V, clipboard save/restore
  - Implement `check_accessibility_permission()` (macOS: osascript test, Windows/Linux: always true)
  - Implement `open_accessibility_settings()` (macOS: open System Preferences, others: no-op)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.3, 6.5_

- [x] 9. Rust backend — Global shortcut handler
  - Implement `hotkey/handler.rs` with `register_hotkey()` and `unregister_all()`
  - Use tauri-plugin-global-shortcut with ShortcutState::Pressed/Released
  - Spawn async tasks for flow::on_press and flow::on_release
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 10. Rust backend — Recording flow orchestration
  - Implement `flow.rs` with `on_press()` and `on_release()` async functions
  - on_press: guard non-Idle state, set phase to Recording, start audio capture, emit events
  - on_release: wait for capture readiness, set phase to Processing, stop capture, resample to 16kHz if needed
  - Run transcription in spawn_blocking, detect keywords if enabled
  - Apply word replacements (case-insensitive) from config
  - Inject text with clipboard preservation, save to history store
  - Handle empty transcription, short recordings (<0.3s), inference errors, injection errors
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 3.8, 7.2, 9.1_

- [x] 11. Rust backend — Persistent configuration store
  - Implement `config_store.rs` with `load_config()` and `save_config()` functions
  - Config file path: `{data_dir}/com.gulshanyadav.spext/config.json`
  - Load returns default config if file missing or invalid
  - Save writes pretty-printed JSON to disk
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 12. Rust backend — Persistent history store
  - Implement `history_store.rs` with HistoryEntry, HistoryData structs
  - Implement `load_history()`, `save_history()`, `add_entry()`, `delete_entry()`, `clear_all()`
  - History file path: `{data_dir}/com.gulshanyadav.spext/history.json`
  - Entries stored newest-first
  - _Requirements: 9.1, 9.2, 9.7, 9.8_

- [x] 13. Rust backend — Tauri IPC commands
  - Implement `commands.rs` with all Tauri command handlers
  - Wire commands: set_config (with disk persistence), get_config, get_recording_phase, list_audio_devices
  - Wire commands: check_accessibility, open_accessibility_settings
  - Wire commands: list_whisper_models, download_whisper_model, delete_whisper_model_cmd
  - Wire commands: detect_keywords, inject_text
  - Wire commands: get_history, add_history_entry, delete_history_entry, clear_history
  - _Requirements: all_

- [x] 14. Rust backend — App entry point and plugin setup
  - Implement `lib.rs` with Tauri Builder configuration
  - Register 4 Tauri plugins: global-shortcut, os, process, log
  - Manage AppState, load config from config_store on startup
  - Register invoke handlers for all 16 commands
  - Setup system tray with Show/Settings/Quit menu
  - Register default hotkey on startup from saved config
  - _Requirements: 1.1, 10.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 15.1, 15.2_

- [x] 15. Rust backend — macOS permissions
  - Add `Info.plist` with NSMicrophoneUsageDescription and NSAppleEventsUsageDescription
  - _Requirements: 6.6_

- [x] 16. Checkpoint — Rust backend compiles
  - Run `cargo build` in src-tauri/ and confirm zero errors.

- [x] 17. Frontend — TypeScript types and Zod schemas
  - Define `SpextConfig`, `WhisperModel` schemas in `types/config.ts` using Zod
  - Define `WordReplacement` interface
  - Define `ModelInfo` interface
  - _Requirements: all_

- [x] 18. Frontend — Zustand stores
  - Implement `stores/recording.ts` with phase, audioLevel, durationSecs, error, lastTranscription
  - Implement `stores/config.ts` with config loading/updating via Tauri invoke
  - _Requirements: 15.3_

- [x] 19. Frontend — Recording flow event hook with audio chimes
  - Implement `hooks/useRecordingFlow.ts` listening to all Rust recording events
  - Map events to store updates: recording-started, audio-level, processing-started, recording-success, recording-error
  - Play start chime on recording-started, stop chime on processing-started
  - Manage duration counter interval
  - Auto-reset phase after success (5s) and error (3s)
  - _Requirements: 11.1, 11.2, 13.1, 13.2, 13.3, 13.4_

- [x] 20. Frontend — Audio chime module
  - Implement `hooks/useRecordingChime.ts` with `playStartChime()` and `playStopChime()`
  - Use Web Audio API with synthesized oscillator tones
  - Create fresh AudioContext each time to avoid suspension issues
  - Close AudioContext after 500ms to free resources
  - Start chime: ascending dual-oscillator (520Hz→420Hz + 780Hz harmonic)
  - Stop chime: descending single-oscillator (380Hz→280Hz)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 21. Frontend — Layout and navigation
  - Implement `components/Layout.tsx` with 72px sidebar, icon + text label nav items
  - Implement active indicator bar with gradient styling using Framer Motion layoutId
  - Set up React Router with routes for /, /history, /settings
  - Implement page transitions with AnimatePresence (fade + slide)
  - Wire App.tsx with BrowserRouter, config loading, recording flow hook
  - _Requirements: 15.4, 15.5, 16.1, 16.2_

- [x] 22. Frontend — Waveform visualizer
  - Implement `components/LiveWaveform.tsx` with Canvas-based real-time waveform
  - Driven by audioLevel from recording store
  - _Requirements: 13.1_

- [x] 23. Frontend — Shortcut selector component
  - Implement `components/ShortcutSelector.tsx` with dropdown-based selection
  - Modifier dropdown (Alt, Ctrl, Shift, Super/Cmd, combinations)
  - Key dropdown (letters, numbers, function keys, special keys)
  - OS-aware labels: macOS symbols (⌘, ⌥, ⌃, ⇧) vs standard labels
  - Live preview of selected shortcut
  - _Requirements: 1.2, 1.6, 14.1_

- [x] 24. Frontend — Home page
  - Implement `pages/HomePage.tsx` with gradient mic orb (110px) with pulse animations
  - Ambient floating background orbs with CSS animations
  - Glass-morphism feature pills (Hold to Talk, Offline, 100+ Languages)
  - Canvas-based waveform visualizer during recording
  - Gradient "Listening" label with elapsed time during recording
  - Gradient "Transcribing..." label during processing
  - Success/error state indicators with auto-dismiss
  - Test output textarea for capturing injected text
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 16.3_

- [x] 25. Frontend — History page
  - Implement `pages/HistoryPage.tsx` with persistent card-based entries
  - Load history from Rust backend on mount via `get_history` command
  - Listen to `save-history` events for live updates
  - Search input filtering by text content (case-insensitive)
  - Relative timestamps (e.g., "5m ago", "2h ago")
  - Copy to clipboard per entry
  - Delete individual entries via `delete_history_entry` command
  - Clear all with confirmation prompt via `clear_history` command
  - Gradient-border card layout with animations
  - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 16.5_

- [x] 26. Frontend — Settings page
  - Implement `pages/SettingsPage.tsx` with gradient-border card sections
  - Shortcut section with ShortcutSelector component (dropdown-based)
  - Models section with grid-layout WhisperModelManager (download, select, delete)
  - Language section with text input
  - Word Replacements section with ReplacementEditor (add/edit/remove rules)
  - Smart Keywords section with animated toggle switch
  - Permissions section with accessibility status and grant button
  - "Save Changes" button visible only when unsaved changes exist
  - Listen to `model-download-progress` events for real-time download progress
  - _Requirements: 4.8, 6.2, 6.3, 6.4, 7.3, 7.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 16.4_

- [x] 27. Frontend — Dark theme styling
  - Implement single dark navy theme with teal/cyan accent colors
  - Custom CSS variables for color tokens
  - Glass-morphism effects (backdrop-blur, semi-transparent backgrounds)
  - Gradient borders for cards
  - Noise texture overlay
  - No light theme
  - _Requirements: 15.5, 16.6_

- [x] 28. Checkpoint — Frontend compiles
  - Run `npx tsc --noEmit` and confirm zero errors.
  - Run `npx vite build` and confirm successful production build.

- [x] 29. Dependency cleanup
  - Remove unused Tauri plugins from Cargo.toml (store, sql, clipboard-manager, dialog, fs, notification, http, opener, shell)
  - Remove unused Rust crates (hound, zip, uuid)
  - Remove unused frontend dependencies (react-query, plugin JS bindings for removed plugins)
  - Final plugin count: 4 (global-shortcut, os, process, log)
  - Verify clean build after cleanup
  - _Requirements: 15.7, 15.8_

- [x] 30. Release optimization
  - Configure Cargo.toml release profile: strip = true, lto = true, codegen-units = 1, opt-level = "s", panic = "abort"
  - Target binary size ~4.7MB
  - _Requirements: 15.8_

- [x] 31. GitHub Actions CI/CD
  - Implement `.github/workflows/build.yml` for cross-platform builds
  - Build matrix: macOS arm64, macOS x64, Linux x64, Windows x64
  - Install platform-specific dependencies (cmake, libasound2-dev, libwebkit2gtk, etc.)
  - Produce artifacts: .dmg, .app (macOS), .deb, .AppImage (Linux), .msi, .exe (Windows)
  - Trigger on version tags and manual dispatch
  - _Requirements: 15.6_

- [x] 32. Integration — End-to-end verification
  - Verify app launches with `npm run tauri dev`
  - Verify model download flow (download Whisper Tiny model)
  - Verify recording flow (hold shortcut, speak, release, verify text injection with clipboard preservation)
  - Verify config persistence (change settings, restart, verify restored)
  - Verify history persistence (transcribe, restart, verify entries present)
  - Verify word replacements applied correctly
  - Verify audio chimes play on start/stop
  - Verify system tray menu (Show, Settings, Quit)
  - Verify cross-platform text injection modules compile
  - _Requirements: all_

## Notes

- All tasks are complete. The application is fully built and functional.
- Whisper.cpp is the sole transcription engine. Vosk was evaluated but removed to reduce complexity, binary size, and external library dependencies.
- The app uses only 4 Tauri plugins (global-shortcut, os, process, log), down from 13 in the original design, significantly reducing binary size and attack surface.
- Configuration is persisted via a custom `config_store.rs` module using JSON files — simpler and more reliable than tauri-plugin-store.
- History is persisted via a custom `history_store.rs` module using JSON files — simpler than SQLite/tauri-plugin-sql for this use case.
- Text injection preserves the user's clipboard by saving before paste and restoring after.
- Audio chime feedback uses Web Audio API with fresh AudioContext instances to avoid browser suspension issues.
- The `whisper-rs` crate compiles whisper.cpp from source via cmake — fully self-contained, no external native library needed.
- All model download URLs point to official HuggingFace sources.
- Cross-platform injection uses OS-native tools: pbcopy/osascript (macOS), PowerShell (Windows), xclip+xdotool (Linux).
- GitHub Actions CI/CD builds for macOS (arm64, x64), Windows (x64), and Linux (x64).
