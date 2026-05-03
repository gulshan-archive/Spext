# Spext — Offline Speech to Text for Desktop

A fully offline desktop speech-to-text application built with Tauri 2.0, React, and TypeScript. Inspired by [Spokenly](https://spokenly.app/), but with zero cloud dependency.

## Features

- **100% Offline** — All transcription runs locally on your machine. No internet required, no data leaves your device.
- **Hold-to-Talk** — Press and hold a global shortcut to record, release to transcribe and inject text into any app.
- **Whisper.cpp** — OpenAI's Whisper models running locally via whisper.cpp. High accuracy, 100+ languages.
- **Vosk** — Kaldi-based lightweight models for fast, real-time transcription (requires libvosk).
- **Model Manager** — Download and manage models directly from the app. Models sourced from HuggingFace (Whisper) and alphacephei.com (Vosk).
- **Smart Keywords** — Say "rephrase as professional email" or "format as bullet points" to tag transcriptions.
- **Transcription History** — Searchable history with copy/export.
- **System Tray** — Runs in the background with a tray icon.
- **Privacy-First** — No API keys, no cloud, no telemetry. Your voice stays on your machine.

## Architecture

```
spext/
├── src/                    # React + TypeScript frontend
│   ├── components/         # UI components (Layout, WaveformVisualizer, RecordingIndicator)
│   ├── hooks/              # Custom React hooks (recording flow events)
│   ├── pages/              # Pages (Home, History, Settings with Model Manager)
│   ├── stores/             # Zustand state management
│   ├── styles/             # Global CSS (Tailwind)
│   └── types/              # TypeScript types + Zod schemas
├── src-tauri/              # Rust backend
│   └── src/
│       ├── audio/          # Microphone capture via cpal (CoreAudio on macOS)
│       ├── hotkey/         # Global shortcut registration
│       ├── injection/      # Text injection (clipboard + Cmd+V)
│       ├── keywords/       # Smart keyword detection
│       ├── models/         # Model download manager (HuggingFace, alphacephei)
│       ├── transcription/  # Whisper.cpp + Vosk offline engines
│       ├── commands.rs     # Tauri IPC command handlers
│       ├── flow.rs         # Recording flow orchestration
│       ├── state.rs        # App state + model definitions
│       └── lib.rs          # App entry point + plugin setup
```

## Supported Models

### Whisper.cpp (from HuggingFace)
| Model | Size | Languages |
|-------|------|-----------|
| Tiny | ~75 MB | Multilingual / English-only |
| Base | ~142 MB | Multilingual / English-only |
| Small | ~466 MB | Multilingual / English-only |
| Medium | ~1.5 GB | Multilingual / English-only |
| Large v3 | ~3.1 GB | Multilingual |
| Large v3 Turbo | ~1.6 GB | Multilingual |

### Vosk (from alphacephei.com)
| Model | Size | Language |
|-------|------|----------|
| Small EN-US | ~40 MB | English (US) |
| EN-US | ~1.8 GB | English (US) |
| Small CN | ~42 MB | Chinese |
| Small RU | ~45 MB | Russian |
| Small DE | ~45 MB | German |
| Small ES | ~39 MB | Spanish |
| Small FR | ~41 MB | French |
| + more | varies | IT, JA, PT, IN |

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 7, Tailwind CSS 4, Zustand, Framer Motion
- **Backend**: Rust, Tauri 2.0, whisper-rs (whisper.cpp bindings), cpal (audio), hound (WAV)
- **Models**: GGML format (Whisper), Kaldi format (Vosk)

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (v20+)
- [CMake](https://cmake.org/) (for building whisper.cpp)
- macOS 10.15+ (for CoreAudio and Accessibility APIs)

```bash
# Install cmake if not present
brew install cmake
```

## Development

```bash
# Install dependencies
cd spext
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## First Run

1. Launch Spext
2. Go to Settings > Models
3. Download a Whisper model (start with "Base" for a good balance of speed and accuracy)
4. Grant Accessibility permission when prompted
5. Hold `Alt+Space` to record, release to transcribe

## Permissions (macOS)

- **Microphone** — Auto-requested on first use
- **Accessibility** — Required for text injection. Grant via System Preferences > Privacy & Security > Accessibility

## License

MIT
