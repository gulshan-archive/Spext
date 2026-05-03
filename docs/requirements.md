# Requirements Document

## Introduction

This document defines the requirements for Spext, a fully offline cross-platform desktop speech-to-text application. Spext allows users to dictate text into any application on their computer by holding a global keyboard shortcut, speaking naturally, and releasing the shortcut to have the transcribed text injected at the cursor position. All transcription runs locally on the user's machine using Whisper.cpp (OpenAI's Whisper models in GGML format) — no internet connection is required during use, and no audio data ever leaves the device. Spext is built with Tauri 2.0 (Rust backend, React + TypeScript frontend) and targets macOS, Windows, and Linux.

## Glossary

- **App**: The Spext desktop application.
- **Global_Shortcut**: A system-wide keyboard shortcut that activates recording regardless of which application is in the foreground.
- **Hold-to-Talk**: The interaction pattern where the user holds the Global_Shortcut to record and releases it to stop recording and trigger transcription.
- **Recording_Session**: The period from when the user begins holding the Global_Shortcut to when the transcribed text is injected or an error occurs.
- **Audio_Capture**: The system component responsible for capturing microphone input as PCM audio samples.
- **Transcription_Engine**: The system component responsible for converting audio samples into text using Whisper.cpp locally.
- **Whisper_Cpp**: The Whisper.cpp engine — OpenAI's Whisper speech recognition model compiled to run locally via the whisper.cpp C++ library, accessed through Rust bindings (whisper-rs).
- **GGML_Model**: A Whisper model file in GGML format, downloaded from HuggingFace, used by Whisper_Cpp.
- **Model_Manager**: The system component responsible for downloading, storing, listing, and deleting transcription models.
- **Text_Injector**: The system component responsible for inserting transcribed text into the frontmost application via the system clipboard and a simulated paste keystroke, with clipboard preservation.
- **Word_Replacement**: A user-defined rule that replaces a spoken word or phrase with a target string (e.g., "colon" → ":"), applied case-insensitively after transcription.
- **Smart_Keywords**: Trigger phrases embedded in speech (e.g., "rephrase as professional email") that tag the transcription for post-processing.
- **Keyword_Detector**: The system component responsible for detecting Smart_Keywords in transcribed text and extracting the clean text.
- **Transcription_History**: A persistent log of all transcriptions performed by the user, stored locally in a JSON file.
- **Config_Store**: The system component responsible for persisting application configuration to a JSON file in the app data directory.
- **History_Store**: The system component responsible for persisting transcription history to a JSON file in the app data directory.
- **System_Tray**: The OS menu bar / system tray area where Spext displays a persistent icon for quick access.
- **Waveform_Visualizer**: A real-time visual representation of audio input levels displayed during recording using HTML5 Canvas.
- **Recording_Phase**: The current state of a Recording_Session: Idle, Recording, Processing, Success, or Error.
- **Audio_Chime**: A synthesized sound played via Web Audio API to provide auditory feedback when recording starts and stops.

---

## Requirements

### Requirement 1: Global Shortcut Registration

**User Story:** As a user, I want to configure a system-wide keyboard shortcut so that I can activate speech recording from any application without switching windows.

#### Acceptance Criteria

1. WHEN the App starts, THE App SHALL register the configured Global_Shortcut with the operating system so that it is active regardless of which application is in the foreground.
2. THE App SHALL support configurable shortcut key combinations via a dropdown-based selector with a modifier dropdown (Alt, Ctrl, Shift, Super/Cmd, and common combinations) and a key dropdown (letters, numbers, function keys, special keys).
3. THE default Global_Shortcut SHALL be `Alt+Space`.
4. WHEN the user changes the Global_Shortcut in Settings, THE App SHALL unregister the previous shortcut and register the new one without requiring an application restart.
5. IF the Global_Shortcut registration fails (e.g., conflict with another application), THEN THE App SHALL display an error message indicating the shortcut could not be registered and suggest an alternative.
6. THE shortcut selector SHALL be OS-aware, displaying macOS symbols (⌘, ⌥, ⌃, ⇧) on macOS and standard labels (Ctrl, Alt, Shift, Super/Win) on Windows and Linux.

---

### Requirement 2: Hold-to-Talk Recording

**User Story:** As a user, I want to hold a shortcut key to record my voice and release it to stop recording, so that I have precise control over when dictation starts and ends.

#### Acceptance Criteria

1. WHEN the user presses and holds the Global_Shortcut, THE Audio_Capture SHALL begin capturing microphone input as 16kHz mono f32 PCM samples.
2. WHILE the user holds the Global_Shortcut, THE App SHALL emit real-time audio level (RMS) events to drive the Waveform_Visualizer.
3. WHEN the user releases the Global_Shortcut, THE Audio_Capture SHALL stop capturing and pass the accumulated audio samples to the Transcription_Engine.
4. THE App SHALL enforce a minimum recording duration of 0.3 seconds; recordings shorter than this SHALL be discarded with a "Recording too short" message.
5. WHILE recording, THE App SHALL transition the Recording_Phase from Idle to Recording, and upon release, from Recording to Processing.
6. IF the Audio_Capture fails to start (e.g., no microphone available), THEN THE App SHALL emit an error event and transition the Recording_Phase to Error.

---

### Requirement 3: Offline Transcription — Whisper.cpp

**User Story:** As a user, I want my speech transcribed locally using Whisper.cpp so that I get high-accuracy results without sending my audio to any server.

#### Acceptance Criteria

1. THE Transcription_Engine SHALL load the selected GGML_Model from the local filesystem and use whisper-rs to perform inference on the captured audio samples.
2. THE Transcription_Engine SHALL support language specification; WHEN the language is set to "auto" or empty, THE engine SHALL auto-detect the spoken language.
3. THE Transcription_Engine SHALL use greedy sampling with a single best-of candidate for speed.
4. THE Transcription_Engine SHALL use 4 threads for parallel processing.
5. THE Transcription_Engine SHALL concatenate all decoded segments into a single text string and return it as the transcription result.
6. IF the selected GGML_Model file does not exist on disk, THEN THE engine SHALL return an error instructing the user to download the model from Settings.
7. IF whisper-rs inference fails, THEN THE engine SHALL return a descriptive error message.
8. THE Transcription_Engine SHALL resample audio to 16kHz if the capture device provides a different sample rate.

---

### Requirement 4: Model Manager

**User Story:** As a user, I want to download and manage Whisper.cpp models from within the app so that I can choose the right balance of accuracy and speed without manual file management.

#### Acceptance Criteria

1. THE Model_Manager SHALL support the following Whisper GGML models: Tiny, Tiny English, Base, Base English, Small, Small English, Medium, Medium English, Large v3, and Large v3 Turbo.
2. FOR each model, THE Model_Manager SHALL display the model name and approximate download size.
3. THE Model_Manager SHALL download GGML_Model files from the official HuggingFace repository (`ggerganov/whisper.cpp`).
4. WHILE downloading, THE Model_Manager SHALL emit progress events containing the model identifier, percentage complete, downloaded bytes, and total bytes.
5. THE Model_Manager SHALL store downloaded models in the application's data directory under a `models/whisper/` subdirectory.
6. THE Model_Manager SHALL provide a function to check whether a given model is already downloaded.
7. THE Model_Manager SHALL provide a function to delete a downloaded model, freeing disk space.
8. THE Settings UI SHALL display models in a grid layout with download status, and allow the user to download, select as active, or delete models.

---

### Requirement 5: Text Injection (Cross-Platform)

**User Story:** As a user, I want the transcribed text to be automatically typed into whatever application I'm currently using so that dictation feels seamless and I don't have to manually copy-paste.

#### Acceptance Criteria

1. WHEN transcription completes successfully, THE Text_Injector SHALL save the current clipboard contents, set the clipboard to the transcribed text, simulate a paste keystroke, and then restore the original clipboard contents.
2. ON macOS, THE Text_Injector SHALL use `pbcopy`/`pbpaste` for clipboard operations and `osascript` System Events to simulate `Cmd+V`.
3. ON Windows, THE Text_Injector SHALL use PowerShell `Set-Clipboard`/`Get-Clipboard` for clipboard operations and `SendKeys` to simulate `Ctrl+V`.
4. ON Linux, THE Text_Injector SHALL use `xclip` or `xsel` for clipboard operations and `xdotool` to simulate `Ctrl+V`.
5. THE Text_Injector SHALL introduce a brief pause (approximately 100ms) before injecting and 150ms after pasting to allow the paste to complete before restoring the clipboard.
6. IF the paste command fails, THEN THE Text_Injector SHALL return an error indicating the failure reason (e.g., Accessibility permission not granted on macOS).

---

### Requirement 6: Accessibility Permission (macOS)

**User Story:** As a user on macOS, I want the app to guide me through granting Accessibility permission so that text injection works correctly.

#### Acceptance Criteria

1. THE App SHALL provide a command to check whether Accessibility permission is currently granted by executing a benign `osascript` System Events test.
2. THE Settings UI SHALL display the current Accessibility permission status with a clear granted/denied indicator.
3. IF Accessibility permission is not granted, THE Settings UI SHALL display a button that opens the macOS System Preferences directly to the Accessibility pane.
4. THE App SHALL re-check Accessibility permission status each time the Settings page is opened and when the window regains focus.
5. ON Windows and Linux, THE accessibility check SHALL always return true as no special permission is required.
6. THE macOS bundle SHALL include `NSMicrophoneUsageDescription` and `NSAppleEventsUsageDescription` in Info.plist.

---

### Requirement 7: Word Replacements

**User Story:** As a user, I want to define word replacement rules so that commonly misheard words or spoken punctuation (e.g., "colon" → ":") are automatically corrected in my transcriptions.

#### Acceptance Criteria

1. THE App SHALL allow users to define a list of Word_Replacement rules, each consisting of a "from" string and a "to" string.
2. AFTER transcription and keyword detection, THE App SHALL apply all Word_Replacement rules to the final text, matching case-insensitively.
3. THE Settings UI SHALL provide a Word Replacement editor where users can add, edit, and remove replacement rules.
4. Word_Replacement rules SHALL be stored as part of the SpextConfig and persisted to the Config_Store.
5. THE replacement editor SHALL display each rule with "from" and "to" input fields and a delete button, plus an "Add replacement" button.

---

### Requirement 8: Smart Keywords

**User Story:** As a user, I want to say trigger phrases like "rephrase as professional email" during dictation so that my transcription is automatically tagged for formatting or post-processing.

#### Acceptance Criteria

1. WHEN Smart_Keywords are enabled in Settings, THE Keyword_Detector SHALL scan the transcribed text for known trigger phrases after transcription completes.
2. THE Keyword_Detector SHALL support the following trigger verbs (matched case-insensitively, longest-first): "rephrase this as", "rewrite this as", "format this as", "rephrase as", "format as", "rewrite as", "rephrase", "summarize this", "summarise this", "summarize", "summarise", "fix grammar", "fix the grammar", "correct grammar".
3. THE Keyword_Detector SHALL support the following known format targets: "professional email", "formal email", "casual email", "casual message", "slack message", "bullet points", "code comment", "formal", "casual", "email", "message", "summary".
4. WHEN a trigger phrase is detected, THE Keyword_Detector SHALL return a match object containing the action type, the optional format target, and the clean text with the trigger phrase removed.
5. IF no trigger phrase is detected, THE Keyword_Detector SHALL return null and the original text SHALL be used as-is.
6. THE App SHALL use the clean text (with trigger removed) as the final text for injection.

---

### Requirement 9: Transcription History (Persistent)

**User Story:** As a user, I want to see a searchable history of my past transcriptions that persists across app restarts so that I can find and reuse text I've previously dictated.

#### Acceptance Criteria

1. AFTER each successful transcription, THE App SHALL save an entry to the History_Store containing: a unique ID, the original transcribed text, the processed text (after replacements/keywords), the language, a timestamp, and the recording duration.
2. THE History_Store SHALL persist entries to a `history.json` file in the application data directory using a custom `history_store.rs` module.
3. THE History UI SHALL display all entries in reverse chronological order (newest first) using a card-based layout with gradient borders.
4. THE History UI SHALL provide a search input that filters entries by matching against both original and processed text (case-insensitive substring match).
5. FOR each entry, THE History UI SHALL display the text, relative timestamp (e.g., "5m ago"), and language badge.
6. THE user SHALL be able to copy any entry's text to the clipboard.
7. THE user SHALL be able to delete individual entries.
8. THE user SHALL be able to clear all history entries with a confirmation prompt.
9. THE History UI SHALL live-update when new transcriptions occur by listening to the `save-history` event.

---

### Requirement 10: Persistent Configuration

**User Story:** As a user, I want my settings to be saved and restored when I restart the app so that I don't have to reconfigure it each time.

#### Acceptance Criteria

1. THE App SHALL persist the SpextConfig to a `config.json` file in the application data directory using a custom `config_store.rs` module.
2. WHEN the App starts, THE App SHALL load the saved configuration from disk; IF the file does not exist or is invalid, THE App SHALL use default configuration values.
3. WHEN the user saves configuration changes, THE App SHALL immediately persist the updated config to disk.
4. THE SpextConfig SHALL include: shortcut, language, whisper_model, smart_keywords_enabled, copy_to_clipboard, and replacements (word replacement rules).

---

### Requirement 11: Audio Chime Feedback

**User Story:** As a user, I want to hear a subtle audio chime when recording starts and stops so that I have clear feedback without needing to look at the screen.

#### Acceptance Criteria

1. WHEN recording starts, THE App SHALL play a soft ascending chime sound.
2. WHEN recording stops (transitions to processing), THE App SHALL play a soft descending chime sound.
3. THE chimes SHALL be generated using the Web Audio API with synthesized oscillator tones (no audio files required).
4. THE App SHALL create a fresh AudioContext for each chime to avoid browser audio suspension issues.
5. THE AudioContext SHALL be closed after the sound finishes playing to free resources.

---

### Requirement 12: System Tray

**User Story:** As a user, I want Spext to run in the system tray so that it's always accessible without cluttering my dock or taskbar.

#### Acceptance Criteria

1. WHEN the App starts, THE App SHALL create a system tray icon.
2. THE system tray icon SHALL display a context menu with options: "Show Spext", "Settings", and "Quit".
3. WHEN the user selects "Show Spext", THE App SHALL show and focus the main window.
4. WHEN the user selects "Settings", THE App SHALL show the main window and navigate to the Settings page.
5. WHEN the user selects "Quit", THE App SHALL exit cleanly.
6. THE system tray tooltip SHALL read "Spext — Offline Speech to Text".

---

### Requirement 13: Recording UI Feedback

**User Story:** As a user, I want clear visual feedback during recording and transcription so that I know the app is listening and processing my speech.

#### Acceptance Criteria

1. WHEN the Recording_Phase transitions to Recording, THE App SHALL display a gradient microphone orb with pulsing animations, expanding pulse rings, a real-time Canvas-based Waveform_Visualizer driven by audio level events, and an elapsed time counter with a gradient "Listening" label.
2. WHEN the Recording_Phase transitions to Processing, THE App SHALL display a gradient "Transcribing..." label.
3. WHEN the Recording_Phase transitions to Success, THE App SHALL display a success indicator with "Text injected ✓". THE indicator SHALL auto-dismiss after 5 seconds.
4. WHEN the Recording_Phase transitions to Error, THE App SHALL display the error message. THE indicator SHALL auto-dismiss after 3 seconds.
5. WHEN the Recording_Phase is Idle, THE App SHALL display the ready state with the configured shortcut key and glass-morphism feature pills (Hold to Talk, Offline, 100+ Languages).
6. THE Home page SHALL include ambient background orbs with floating animations and a test output textarea where users can focus to receive injected text.

---

### Requirement 14: Settings UI

**User Story:** As a user, I want a settings page where I can configure the shortcut, manage models, set word replacements, and adjust preferences.

#### Acceptance Criteria

1. THE Settings UI SHALL provide a Shortcut section with a dropdown-based shortcut selector (modifier dropdown + key dropdown) that is OS-aware.
2. THE Settings UI SHALL provide a Models section that displays Whisper GGML models in a grid layout with download, select, and delete actions for each model.
3. THE Settings UI SHALL provide a Language section with a text input for the language code and a note about auto-detection support.
4. THE Settings UI SHALL provide a Word Replacements section with an editor for adding, editing, and removing replacement rules.
5. THE Settings UI SHALL provide a Smart Keywords toggle with an explanation of supported trigger phrases, using an animated toggle switch.
6. THE Settings UI SHALL provide a Permissions section showing the Accessibility permission status with a grant button (relevant on macOS).
7. THE Settings UI SHALL display a "Save Changes" button only when unsaved changes exist, and SHALL persist changes to the Rust backend and disk on save.
8. THE Settings UI SHALL use gradient-border cards for each settings section.

---

### Requirement 15: Application Lifecycle and Cross-Platform Support

**User Story:** As a user, I want the app to start quickly, remember my settings, and run reliably on macOS, Windows, and Linux.

#### Acceptance Criteria

1. WHEN the App starts, THE App SHALL load the saved configuration from the Config_Store and register the Global_Shortcut.
2. WHEN the App starts, THE App SHALL initialize the system tray.
3. THE App SHALL persist configuration changes to disk via the Config_Store on every save.
4. THE main window SHALL be resizable with a minimum size of 700×500 pixels and SHALL open centered on the screen.
5. THE App SHALL use a single dark navy theme with teal/cyan accent colors and consistent color tokens across all UI components.
6. THE App SHALL target macOS (arm64, x64), Windows (x64), and Linux (x64) via GitHub Actions CI/CD.
7. THE App SHALL use only 4 Tauri plugins: global-shortcut, os, process, and log.
8. THE release binary SHALL be optimized with LTO, symbol stripping, and size optimization (target ~4.7MB).

---

### Requirement 16: UI Design

**User Story:** As a user, I want a polished, modern dark-themed interface that feels premium and responsive.

#### Acceptance Criteria

1. THE App SHALL use a wider sidebar (72px) with icon + text label navigation items and an active indicator bar with gradient styling.
2. THE App SHALL use page transitions (fade + slide) when navigating between pages via Framer Motion.
3. THE Home page SHALL feature a large gradient microphone orb (110px), ambient floating background orbs, and glass-morphism feature pills.
4. THE Settings page SHALL use gradient-border cards for each section.
5. THE History page SHALL use card-based entries with gradient borders, relative timestamps, and inline copy/delete actions.
6. THE App SHALL NOT include a light theme — dark navy theme only.

---

### Requirement 17: Privacy and Offline Operation

**User Story:** As a user, I want complete assurance that my voice data never leaves my machine so that I can use Spext for sensitive dictation without privacy concerns.

#### Acceptance Criteria

1. THE App SHALL NOT make any network requests during transcription. All speech-to-text processing SHALL occur locally using downloaded models.
2. THE App SHALL only make network requests for model downloads, initiated explicitly by the user from the Settings UI.
3. THE App SHALL NOT include any telemetry, analytics, or crash reporting that transmits data to external servers.
4. THE App SHALL store all data (models, history, configuration) in the local application data directory.
