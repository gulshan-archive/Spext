import { useState, useEffect } from "react";
import { platform } from "@tauri-apps/plugin-os";

interface ShortcutSelectorProps {
  value: string;
  onChange: (shortcut: string) => void;
}

// Modifier options per platform
const MAC_MODIFIERS = [
  { value: "", label: "None" },
  { value: "Alt", label: "⌥ Option" },
  { value: "Control", label: "⌃ Control" },
  { value: "Shift", label: "⇧ Shift" },
  { value: "Super", label: "⌘ Command" },
  { value: "Alt+Shift", label: "⌥⇧ Option+Shift" },
  { value: "Control+Shift", label: "⌃⇧ Control+Shift" },
  { value: "Super+Shift", label: "⌘⇧ Command+Shift" },
  { value: "Control+Alt", label: "⌃⌥ Control+Option" },
  { value: "Super+Alt", label: "⌘⌥ Command+Option" },
];

const OTHER_MODIFIERS = [
  { value: "", label: "None" },
  { value: "Alt", label: "Alt" },
  { value: "Control", label: "Ctrl" },
  { value: "Shift", label: "Shift" },
  { value: "Super", label: "Super/Win" },
  { value: "Alt+Shift", label: "Alt+Shift" },
  { value: "Control+Shift", label: "Ctrl+Shift" },
  { value: "Control+Alt", label: "Ctrl+Alt" },
  { value: "Super+Alt", label: "Super+Alt" },
];

// Key options (same across platforms)
const KEYS = [
  { value: "Space", label: "Space" },
  { value: "Enter", label: "Enter" },
  { value: "Tab", label: "Tab" },
  { value: "Backspace", label: "Backspace" },
  { value: "Escape", label: "Escape" },
  { value: "CapsLock", label: "CapsLock" },
  // Letters
  ...Array.from({ length: 26 }, (_, i) => {
    const letter = String.fromCharCode(65 + i);
    return { value: letter, label: letter };
  }),
  // Numbers
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i),
    label: String(i),
  })),
  // Function keys
  ...Array.from({ length: 12 }, (_, i) => ({
    value: `F${i + 1}`,
    label: `F${i + 1}`,
  })),
  // Extended function keys
  ...Array.from({ length: 8 }, (_, i) => ({
    value: `F${i + 13}`,
    label: `F${i + 13}`,
  })),
  // Punctuation
  { value: "`", label: "` (Backtick)" },
  { value: "-", label: "- (Minus)" },
  { value: "=", label: "= (Equals)" },
  { value: "[", label: "[ (Left Bracket)" },
  { value: "]", label: "] (Right Bracket)" },
  { value: "\\", label: "\\ (Backslash)" },
  { value: ";", label: "; (Semicolon)" },
  { value: "'", label: "' (Quote)" },
  { value: ",", label: ", (Comma)" },
  { value: ".", label: ". (Period)" },
  { value: "/", label: "/ (Slash)" },
];

function parseShortcut(shortcut: string): { modifier: string; key: string } {
  const parts = shortcut.split("+");
  const modifierParts: string[] = [];
  let key = "";

  for (const part of parts) {
    if (["Control", "Alt", "Shift", "Super"].includes(part)) {
      modifierParts.push(part);
    } else {
      key = part;
    }
  }

  return { modifier: modifierParts.join("+"), key };
}

function buildShortcut(modifier: string, key: string): string {
  if (!key) return "";
  if (!modifier) return key;
  return `${modifier}+${key}`;
}

export function ShortcutSelector({ value, onChange }: ShortcutSelectorProps) {
  const [isMac, setIsMac] = useState(true);
  const { modifier, key } = parseShortcut(value);
  const [selectedModifier, setSelectedModifier] = useState(modifier);
  const [selectedKey, setSelectedKey] = useState(key);

  useEffect(() => {
    try {
      const p = platform();
      setIsMac(p === "macos");
    } catch {
      // default to mac
    }
  }, []);

  // Sync from parent value
  useEffect(() => {
    const parsed = parseShortcut(value);
    setSelectedModifier(parsed.modifier);
    setSelectedKey(parsed.key);
  }, [value]);

  const modifiers = isMac ? MAC_MODIFIERS : OTHER_MODIFIERS;

  const handleModifierChange = (mod: string) => {
    setSelectedModifier(mod);
    const shortcut = buildShortcut(mod, selectedKey);
    if (shortcut) onChange(shortcut);
  };

  const handleKeyChange = (k: string) => {
    setSelectedKey(k);
    const shortcut = buildShortcut(selectedModifier, k);
    if (shortcut) onChange(shortcut);
  };

  const displayShortcut = buildShortcut(selectedModifier, selectedKey);

  return (
    <div className="space-y-3">
      <label className="text-sm t-text-s">Hold-to-talk shortcut</label>

      <div className="flex items-center gap-2">
        {/* Modifier dropdown */}
        <select
          value={selectedModifier}
          onChange={(e) => handleModifierChange(e.target.value)}
          className="flex-1 px-3 py-2 t-bg-t border t-border rounded-lg text-sm t-text focus:outline-none focus:border-accent appearance-none cursor-pointer"
        >
          {modifiers.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <span className="t-text-m text-lg font-light">+</span>

        {/* Key dropdown */}
        <select
          value={selectedKey}
          onChange={(e) => handleKeyChange(e.target.value)}
          className="flex-1 px-3 py-2 t-bg-t border t-border rounded-lg text-sm t-text focus:outline-none focus:border-accent appearance-none cursor-pointer"
        >
          <option value="">Select key...</option>
          {KEYS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      {/* Preview */}
      {displayShortcut && (
        <div className="flex items-center gap-2">
          <span className="text-xs t-text-m">Shortcut:</span>
          <kbd className="px-2 py-0.5 t-bg border t-border rounded text-xs font-mono t-accent">
            {displayShortcut}
          </kbd>
        </div>
      )}

      <p className="text-xs t-text-m">
        Choose a modifier and key combination. The shortcut works system-wide even when Spext is in the background.
      </p>
    </div>
  );
}
