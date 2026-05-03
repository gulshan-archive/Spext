import { useState, useEffect, useRef, useCallback } from "react";
import { Keyboard } from "lucide-react";

interface ShortcutRecorderProps {
  value: string;
  onChange: (shortcut: string) => void;
}

const SYSTEM_SHORTCUTS = new Set([
  "Super+Space", "Super+Tab", "Super+Q", "Super+W", "Super+C",
  "Super+V", "Super+X", "Super+Z", "Super+A", "Super+S", "Control+Space",
]);

function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");

  // If the key itself is a modifier, don't add it again
  if (!["Meta", "Control", "Alt", "Shift"].includes(e.key)) {
    // Map key to Tauri format
    if (/^F\d+$/.test(e.key)) {
      parts.push(e.key);
    } else if (e.key === " ") {
      parts.push("Space");
    } else if (e.key.length === 1) {
      parts.push(e.key.toUpperCase());
    } else {
      const map: Record<string, string> = {
        Enter: "Enter", Tab: "Tab", Escape: "Escape",
        Backspace: "Backspace", Delete: "Delete",
        ArrowUp: "ArrowUp", ArrowDown: "ArrowDown",
        ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
        Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
        CapsLock: "CapsLock", Insert: "Insert",
      };
      if (map[e.key]) parts.push(map[e.key]);
      else parts.push(e.key);
    }
  }

  return parts.join("+");
}

function displayFormat(s: string): string {
  return s
    .replace(/Super/g, "⌘")
    .replace(/Control/g, "⌃")
    .replace(/Alt/g, "⌥")
    .replace(/Shift/g, "⇧");
}

export function ShortcutRecorder({ value, onChange }: ShortcutRecorderProps) {
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState("");
  const [conflict, setConflict] = useState<string | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const done = useCallback(
    (combo: string) => {
      if (!combo) return;
      if (SYSTEM_SHORTCUTS.has(combo)) {
        setConflict(`"${displayFormat(combo)}" is a system shortcut.`);
      } else {
        setConflict(null);
        onChange(combo);
      }
      setLive("");
      setListening(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!listening) return;

    let best = "";

    const onDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const combo = eventToCombo(e);
      if (combo && combo.split("+").length >= (best.split("+").length || 0)) {
        best = combo;
      }
      setLive(combo || best);
    };

    // Finalize when ALL keys are released
    const onUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Check if no modifier keys are still held
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        // All keys released — finalize with the best combo we saw
        if (best) {
          done(best);
          best = "";
        }
      }
    };

    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, [listening, done]);

  // Cancel on outside click
  useEffect(() => {
    if (!listening) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setListening(false);
        setLive("");
      }
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [listening]);

  const text = listening
    ? live ? displayFormat(live) : "Press keys..."
    : value ? displayFormat(value) : "Not set";

  return (
    <div className="space-y-2">
      <label className="text-sm text-text-secondary">Hold-to-talk shortcut</label>
      <button
        ref={ref}
        onClick={() => {
          setListening(true);
          setLive("");
          setConflict(null);
        }}
        className={`w-full px-3 py-2.5 rounded-lg text-sm text-left flex items-center gap-2 transition-all ${
          listening
            ? "bg-accent/10 border-2 border-accent text-accent ring-2 ring-accent/20"
            : "bg-bg-tertiary border border-border text-text-primary hover:border-border-light"
        }`}
      >
        <Keyboard size={16} className={listening ? "text-accent" : "text-text-muted"} />
        <span className={`font-mono text-base ${listening ? "animate-pulse" : ""}`}>
          {text}
        </span>
      </button>
      {conflict && <p className="text-xs text-error">{conflict}</p>}
      <p className="text-xs text-text-muted">
        {listening
          ? "Press your desired key combo, then release all keys."
          : "Click to record. Note: macOS Fn key is hardware-only and cannot be captured by any app."}
      </p>
    </div>
  );
}
