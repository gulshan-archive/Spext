# Spext — Offline Speech to Text

A fully offline, cross-platform desktop speech-to-text app. Runs entirely on your CPU — no GPU, no internet, no cloud APIs.

Built with Tauri 2.0 (Rust) + React + TypeScript. Binary size: ~4.7 MB.

## Features

- **100% Offline** — All transcription runs locally using Whisper.cpp. No data leaves your device.
- **Cross-Platform** — macOS, Windows, and Linux.
- **Hold-to-Talk** — Hold a global shortcut to record, release to transcribe and paste text at your cursor.
- **Clipboard Preservation** — Your clipboard is saved before paste and restored after.
- **Word Replacements** — Define rules like "colon" → ":" that auto-apply to transcriptions.
- **Smart Keywords** — Say "rephrase as email" to tag transcriptions for post-processing.
- **Persistent History** — Searchable transcription history (7-day retention), saved to disk.
- **Persistent Settings** — All configuration saved and restored across app restarts.
- **Audio Chime** — Configurable beep sound on record start/stop with volume control.
- **Model Manager** — Download Whisper models (Tiny to Large v3) directly from the app.
- **System Tray** — Runs in the background with a tray icon.
- **Dark Theme** — Polished dark navy UI with teal/cyan accents.

## Supported Models

Downloaded from [HuggingFace](https://huggingface.co/ggerganov/whisper.cpp) (GGML format):

| Model | Size | Languages |
|-------|------|-----------|
| Tiny / Tiny EN | ~75 MB | Multilingual / English-only |
| Base / Base EN | ~142 MB | Multilingual / English-only |
| Small / Small EN | ~466 MB | Multilingual / English-only |
| Medium / Medium EN | ~1.5 GB | Multilingual / English-only |
| Large v3 | ~3.1 GB | Multilingual |
| Large v3 Turbo | ~1.6 GB | Multilingual |

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 7, Tailwind CSS 4, Zustand, Framer Motion, Zod
- **Backend**: Rust, Tauri 2.0, whisper-rs, cpal (audio capture), reqwest (model downloads)
- **Plugins**: tauri-plugin-global-shortcut, tauri-plugin-os, tauri-plugin-process, tauri-plugin-log

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) (v20+)
- [CMake](https://cmake.org/) (for building whisper.cpp)

```bash
# macOS
brew install cmake

# Ubuntu/Debian
sudo apt install cmake libasound2-dev libwebkit2gtk-4.1-dev libappindicator3-dev

# Windows
choco install cmake
```

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
# macOS (.app + .dmg)
npm run tauri build

# All platforms via GitHub Actions
# Go to Actions tab → Run workflow → select platforms
```

## First Run

1. Launch Spext
2. Go to **Settings → Models** → download a model (start with "Base")
3. Grant **Microphone** permission when prompted
4. Grant **Accessibility** permission (macOS only: System Settings → Privacy → Accessibility)
5. Hold **Alt+Space** → speak → release → text appears at your cursor

## Text Injection

| Platform | Clipboard | Paste |
|----------|-----------|-------|
| macOS | `pbcopy` / `pbpaste` | `osascript` Cmd+V |
| Windows | PowerShell `Set-Clipboard` | `SendKeys` Ctrl+V |
| Linux | `xclip` / `xsel` | `xdotool` Ctrl+V |

Linux requires: `sudo apt install xclip xdotool`

## Data Storage

All data stored locally in the app data directory:

| Data | File |
|------|------|
| Settings | `config.json` |
| History | `history.json` |
| Models | `models/whisper/*.bin` |

Locations: `~/Library/Application Support/com.gulshanyadav.spext/` (macOS), `%APPDATA%` (Windows), `~/.local/share` (Linux)

## License

MIT
