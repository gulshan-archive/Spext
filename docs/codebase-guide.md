# Spext Codebase Guide

A plain-English guide to the entire Spext codebase. Written so you can find and change anything without knowing Rust or Tauri internals.

---

## How the App is Structured

Spext has two halves that talk to each other:

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   FRONTEND (what you see)   │ ←→  │   BACKEND (what does work)  │
│   React + TypeScript        │     │   Rust                      │
│   Lives in: spext/src/      │     │   Lives in: spext/src-tauri/ │
└─────────────────────────────┘     └─────────────────────────────┘
```

The **frontend** is a web app (React) that runs inside a native window. It handles the UI — buttons, pages, animations, settings forms.

The **backend** is a Rust program that handles the heavy lifting — recording audio, running Whisper AI, pasting text into other apps, saving files.

They communicate through two mechanisms:
- **Commands**: Frontend calls backend functions (like "give me the config" or "download this model")
- **Events**: Backend sends messages to frontend (like "recording started" or "here's the audio level")

---

## Folder Map

```
spext/
├── src/                          ← FRONTEND (React + TypeScript)
│   ├── main.tsx                  ← App entry point
│   ├── App.tsx                   ← Routes (which page to show)
│   ├── components/               ← Reusable UI pieces
│   │   ├── Layout.tsx            ← Sidebar + page container
│   │   ├── LiveWaveform.tsx      ← Animated waveform bars (canvas)
│   │   ├── RecordingIndicator.tsx← Mic orb + status animations
│   │   └── ShortcutSelector.tsx  ← Dropdown for choosing shortcut keys
│   ├── hooks/                    ← Logic that connects to backend
│   │   ├── useRecordingFlow.ts   ← Listens to backend events, updates UI state
│   │   └── useRecordingChime.ts  ← Plays beep sounds via Web Audio API
│   ├── pages/                    ← Full-page views
│   │   ├── HomePage.tsx          ← Main screen (mic orb, waveform, test output)
│   │   ├── HistoryPage.tsx       ← Past transcriptions list
│   │   └── SettingsPage.tsx      ← All settings (shortcut, models, language, etc.)
│   ├── stores/                   ← Shared state (like global variables)
│   │   ├── recording.ts          ← Current recording phase, audio level, etc.
│   │   └── config.ts             ← App configuration (shortcut, language, etc.)
│   ├── styles/
│   │   └── globals.css           ← Colors, theme, utility classes
│   └── types/
│       ├── config.ts             ← TypeScript types for config
│       ├── recording.ts          ← TypeScript types for recording state
│       └── history.ts            ← TypeScript types for history entries
│
├── src-tauri/                    ← BACKEND (Rust)
│   ├── Cargo.toml                ← Rust dependencies (like package.json for Rust)
│   ├── tauri.conf.json           ← App window size, title, bundle settings
│   ├── capabilities/
│   │   └── default.json          ← Permissions (which plugins the app can use)
│   ├── icons/                    ← App icons (all sizes)
│   ├── Info.plist                ← macOS permissions (microphone, accessibility)
│   └── src/
│       ├── main.rs               ← Rust entry point (just calls lib.rs)
│       ├── lib.rs                ← App setup: registers plugins, commands, tray menu
│       ├── state.rs              ← Data structures: config, models, recording phase
│       ├── flow.rs               ← THE CORE: what happens when you press/release shortcut
│       ├── commands.rs           ← Functions the frontend can call
│       ├── config_store.rs       ← Saves/loads config.json to disk
│       ├── history_store.rs      ← Saves/loads history.json to disk
│       ├── audio/
│       │   └── capture.rs        ← Records from microphone
│       ├── transcription/
│       │   ├── engine.rs         ← Routes to Whisper
│       │   └── whisper.rs        ← Runs Whisper AI model on audio
│       ├── models/
│       │   └── manager.rs        ← Downloads/deletes AI models
│       ├── keywords/
│       │   └── detector.rs       ← Detects "rephrase as email" etc.
│       ├── injection/
│       │   ├── mod.rs            ← Cross-platform dispatcher
│       │   ├── macos.rs          ← Paste text on macOS
│       │   ├── windows.rs        ← Paste text on Windows
│       │   └── linux.rs          ← Paste text on Linux
│       └── hotkey/
│           └── handler.rs        ← Registers the keyboard shortcut
│
├── docs/                         ← Documentation
├── public/                       ← Static files (SVG icon)
├── package.json                  ← Frontend dependencies
├── vite.config.ts                ← Frontend build tool config
└── .github/workflows/build.yml   ← CI/CD for building on all platforms
```

---

## The Recording Flow (What Happens When You Press the Shortcut)

This is the most important flow in the app. Here's exactly what happens step by step:

### 1. You press Alt+Space (or your configured shortcut)

**File: `src-tauri/src/hotkey/handler.rs`**

The `register_hotkey` function registered a listener when the app started. When you press the key, it detects `ShortcutState::Pressed` and calls `flow::on_press()`.

### 2. Recording starts

**File: `src-tauri/src/flow.rs` → `on_press()`**

- Checks if we're in "Idle" state (not already recording)
- Sets the state to "Recording"
- Tells the audio module to start capturing from the microphone
- Sends a "recording-started" event to the frontend

### 3. Frontend plays the beep and shows recording UI

**File: `src/hooks/useRecordingFlow.ts`**

- Receives the "recording-started" event
- Checks if chime is enabled in config → plays start beep (`useRecordingChime.ts`)
- Updates the recording store → phase becomes "recording"
- The HomePage sees the phase change and shows the pulsing mic orb + waveform

### 4. Audio is being captured

**File: `src-tauri/src/audio/capture.rs`**

- The microphone is open and sending audio data into a buffer
- Every chunk of audio, it calculates the volume level (RMS) and sends it to the frontend as an "audio-level" event
- The frontend uses this to animate the waveform bars

### 5. You release the shortcut

**File: `src-tauri/src/hotkey/handler.rs`**

Detects `ShortcutState::Released` and calls `flow::on_release()`.

### 6. Transcription happens

**File: `src-tauri/src/flow.rs` → `on_release()`**

- Stops the audio capture, gets all the recorded samples
- If the recording was too short (< 0.3 seconds), shows an error
- Resamples the audio to 16kHz if the microphone used a different rate
- Sends the audio to Whisper for transcription (this runs in a background thread so the app doesn't freeze)

**File: `src-tauri/src/transcription/whisper.rs`**

- Loads the Whisper AI model from disk
- Feeds the audio samples into the model
- Gets back the transcribed text

### 7. Post-processing

**File: `src-tauri/src/flow.rs` → `on_release()` (continued)**

- If Smart Keywords are enabled, checks for trigger phrases like "rephrase as email" and strips them out
- Applies Word Replacements (e.g., "colon" → ":")
- Both are case-insensitive

### 8. Text injection

**File: `src-tauri/src/injection/macos.rs` (or windows.rs / linux.rs)**

- Saves your current clipboard contents
- Copies the transcribed text to clipboard
- Simulates Cmd+V (or Ctrl+V on Windows/Linux) to paste
- Waits a moment, then restores your original clipboard

### 9. Save to history

**File: `src-tauri/src/history_store.rs`**

- Creates a history entry with the text, timestamp, language, duration
- Saves it to `history.json` in the app data folder
- Also removes any entries older than 7 days

### 10. Frontend shows success

**File: `src/hooks/useRecordingFlow.ts`**

- Receives "recording-success" event with the transcribed text
- Plays the stop beep
- Shows "Text injected ✓" on the home page
- Auto-resets to idle after 5 seconds

---

## Common Changes and Where to Make Them

### "I want to change the default shortcut key"

**File: `src-tauri/src/state.rs`**
Find `impl Default for SpextConfig` and change the `shortcut` field:
```rust
shortcut: "Alt+Space".to_string(),  // Change this
```

Also update the TypeScript default in `src/types/config.ts`:
```typescript
shortcut: z.string().default("Alt+Space"),  // Change this
```

### "I want to change the default language"

Same two files as above. Change the `language` field:
```rust
language: "en".to_string(),  // Change to "hi", "fr", "auto", etc.
```

### "I want to add a new Whisper model option"

**File: `src-tauri/src/state.rs`**
1. Add a new variant to the `WhisperModel` enum
2. Add its download URL in `download_url()`
3. Add its filename in `filename()`
4. Add its display name in `display_name()`
5. Add it to the `all()` list

**File: `src/types/config.ts`**
Add the new model ID to the `WhisperModelSchema` enum.

### "I want to change the app colors"

**File: `src/styles/globals.css`**
All colors are defined as CSS variables in the `:root` section:
```css
:root {
  --rt-bg-primary: #08090d;      /* Main background */
  --rt-bg-secondary: #0e1118;    /* Card backgrounds */
  --rt-accent: #06b6d4;          /* Teal accent color */
  --rt-text-primary: #edf0f7;    /* Main text color */
  /* ... etc */
}
```
Change any value and the whole app updates.

### "I want to change the beep sound"

**File: `src/hooks/useRecordingChime.ts`**
- `playStartChime()`: Change the frequency values (520, 780) for different tones
- `playStopChime()`: Change the frequency values (380, 280)
- The `volume` parameter (0-1) controls loudness

### "I want to change what the app window looks like (size, title)"

**File: `src-tauri/tauri.conf.json`**
```json
"windows": [{
  "title": "Spext",        // Window title
  "width": 900,            // Default width
  "height": 650,           // Default height
  "minWidth": 700,         // Minimum width
  "minHeight": 500         // Minimum height
}]
```

### "I want to change the system tray menu"

**File: `src-tauri/src/lib.rs`**
Find the `setup_tray` function. The menu items are created with `MenuItemBuilder`:
```rust
let show = MenuItemBuilder::with_id("show", "Show Spext").build(app)?;
let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
```
Add or remove items here. The `on_menu_event` closure handles what happens when each is clicked.

### "I want to add a new setting"

1. **Add the field to Rust config** (`src-tauri/src/state.rs` → `SpextConfig` struct + default)
2. **Add the field to TypeScript config** (`src/types/config.ts` → `SpextConfigSchema`)
3. **Add UI in Settings page** (`src/pages/SettingsPage.tsx` — add a new `GradientCard` section)
4. **Use it wherever needed** (e.g., in `flow.rs` if it affects recording behavior)

### "I want to change how text is pasted on macOS"

**File: `src-tauri/src/injection/macos.rs`**
- `set_clipboard()`: Uses `pbcopy` command
- `send_paste()`: Uses `osascript` to simulate Cmd+V
- `inject_text()`: The main function that orchestrates save → paste → restore

### "I want to change how text is pasted on Windows"

**File: `src-tauri/src/injection/windows.rs`**
- Uses PowerShell commands for clipboard and SendKeys for Ctrl+V

### "I want to change how text is pasted on Linux"

**File: `src-tauri/src/injection/linux.rs`**
- Uses `xclip`/`xsel` for clipboard and `xdotool` for Ctrl+V

### "I want to change the history retention period"

**File: `src-tauri/src/history_store.rs`**
Find `chrono::Duration::days(7)` and change the number:
```rust
let cutoff = chrono::Utc::now() - chrono::Duration::days(7);  // Change 7 to any number
```

### "I want to add a new page to the app"

1. Create `src/pages/NewPage.tsx`
2. Add a route in `src/App.tsx`
3. Add a nav item in `src/components/Layout.tsx` (add to the `navItems` array)

### "I want to change the sidebar icons"

**File: `src/components/Layout.tsx`**
The `navItems` array defines each sidebar button:
```typescript
const navItems = [
  { to: "/", icon: Mic, label: "Record" },
  { to: "/history", icon: History, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];
```
Icons come from the `lucide-react` package. Browse available icons at https://lucide.dev/icons

### "I want to change the app version"

Two places:
1. `src-tauri/tauri.conf.json` → `"version": "0.1.0"`
2. `package.json` → `"version": "0.1.0"`

### "I want to add a new word replacement trigger"

Word replacements are user-configurable in Settings. But if you want to add built-in defaults, edit `src-tauri/src/state.rs`:
```rust
replacements: vec![
    WordReplacement { from: "colon".to_string(), to: ":".to_string() },
    // Add more here
],
```

---

## Where Data is Stored on the User's Machine

| Data | Location (macOS) | Location (Windows) | Location (Linux) |
|------|------------------|--------------------|-------------------|
| Config | `~/Library/Application Support/com.gulshanyadav.spext/config.json` | `%APPDATA%/com.gulshanyadav.spext/config.json` | `~/.local/share/com.gulshanyadav.spext/config.json` |
| History | Same folder, `history.json` | Same folder | Same folder |
| Models | Same folder, `models/whisper/` | Same folder | Same folder |

---

## How to Build

```bash
# Development (hot reload)
cd spext
npm run tauri dev

# Production build (macOS)
npm run tauri build
# Output: src-tauri/target/release/bundle/macos/Spext.app

# Just check if code compiles
cargo build                    # Rust backend
npx tsc --noEmit              # TypeScript frontend
npx vite build                # Frontend bundle
```

### Build Requirements
- **Rust** (install via https://rustup.rs)
- **Node.js** 20+ (install via https://nodejs.org)
- **cmake** (install via `brew install cmake` on macOS)

---

## Key Concepts

### Tauri Commands
When the frontend needs something from the backend, it calls a "command":
```typescript
// Frontend calls:
const config = await invoke<SpextConfig>("get_config");

// Backend handles it in commands.rs:
#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<SpextConfig, String> { ... }
```

### Tauri Events
When the backend needs to tell the frontend something, it emits an "event":
```rust
// Backend emits:
let _ = app.emit("recording-started", ());

// Frontend listens:
await listen("recording-started", () => { ... });
```

### Zustand Stores
Shared state that any component can read/write:
```typescript
// Read state:
const { phase } = useRecordingStore();

// Write state:
useRecordingStore.getState().setPhase("recording");
```

### CSS Theme Variables
All colors use CSS variables so changing one value updates everywhere:
```css
.t-text { color: var(--rt-text-primary); }    /* Use in className */
style={{ color: "var(--rt-accent)" }}          /* Use in inline style */
```
