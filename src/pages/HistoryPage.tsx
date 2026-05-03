import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Copy, Trash2, Clock, Check } from "lucide-react";

interface HistoryEntry {
  id: string;
  text: string;
  original_text: string;
  language: string;
  timestamp: string;
  duration_secs: number;
}

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load history from Rust on mount
  const loadHistory = () => {
    invoke<HistoryEntry[]>("get_history").then(setEntries).catch(console.error);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Listen for new entries (live update when transcription happens)
  useEffect(() => {
    const unlisten = listen("save-history", () => {
      loadHistory();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const filtered = entries.filter((e) =>
    e.text.toLowerCase().includes(search.toLowerCase()) ||
    e.original_text.toLowerCase().includes(search.toLowerCase())
  );

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      console.error("Copy failed");
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await invoke("delete_history_entry", { id });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  const clearAll = async () => {
    try {
      await invoke("clear_history");
      setEntries([]);
      setShowClearConfirm(false);
    } catch (e) {
      console.error("Clear failed:", e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col t-bg relative">
      {/* Header */}
      <div className="drag-region flex items-center justify-between relative z-10" style={{ padding: "10px 12px" }}>
        <div className="no-drag">
          <h1 className="text-base font-bold t-text tracking-tight">History</h1>
          <p className="text-[11px] t-text-m">{entries.length} transcription{entries.length !== 1 ? "s" : ""}</p>
        </div>
        {entries.length > 0 && (
          <div className="no-drag">
            {showClearConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] t-text-m">Clear all?</span>
                <button onClick={clearAll} className="px-2 py-1 text-[11px] font-medium rounded-lg press" style={{ background: "rgba(251,113,133,0.15)", color: "var(--rt-error)" }}>
                  Yes
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="px-2 py-1 text-[11px] t-text-m font-medium rounded-lg t-bg-t press">
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-3 py-1 text-[11px] t-text-m font-medium rounded-lg t-bg-t press"
                style={{ border: "1px solid var(--rt-border)" }}
              >
                Clear All
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      {entries.length > 0 && (
        <div style={{ padding: "0 12px 8px 12px", position: "relative", zIndex: 10 }}>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--rt-accent)", zIndex: 2 }} />
            <input
              type="text"
              placeholder="Search transcriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-xl t-text focus:outline-none transition-colors"
              style={{
                paddingLeft: 36,
                paddingRight: 16,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 14,
                background: "var(--rt-bg-secondary)",
                borderColor: "var(--rt-border)",
                caretColor: "var(--rt-accent)",
                position: "relative",
                zIndex: 1,
              }}
              onFocus={(e) => e.target.style.borderColor = "rgba(6,182,212,0.4)"}
              onBlur={(e) => e.target.style.borderColor = "var(--rt-border)"}
            />
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto relative z-10" style={{ padding: "0 12px 12px 12px" }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Clock size={36} className="t-text-m mb-3" style={{ opacity: 0.3 }} />
            <p className="text-sm t-text-m">
              {search ? "No matching transcriptions" : "No transcriptions yet"}
            </p>
            <p className="text-[11px] t-text-m mt-1">
              {search ? "Try a different search" : "Use your shortcut to start recording"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence>
              {filtered.map((entry) => (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.2 }}
                  className="gradient-border p-3 press"
                >
                  {/* Text */}
                  <p className="text-sm t-text leading-relaxed mb-2" style={{ wordBreak: "break-word" }}>
                    {entry.text}
                  </p>

                  {/* Meta + Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] t-text-m">{formatDate(entry.timestamp)}</span>
                      <span className="text-[10px] t-text-m px-1.5 py-0.5 rounded t-bg-t" style={{ border: "1px solid var(--rt-border)" }}>
                        {entry.language || "en"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyText(entry.id, entry.text)}
                        className="p-1.5 rounded-lg t-text-m transition-colors press"
                        title="Copy"
                        style={{ background: copiedId === entry.id ? "rgba(52,211,153,0.1)" : "transparent" }}
                      >
                        {copiedId === entry.id ? (
                          <Check size={13} style={{ color: "var(--rt-success)" }} />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="p-1.5 rounded-lg t-text-m transition-colors press"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
