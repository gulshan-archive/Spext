import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Globe, Sparkles, Keyboard, Shield, CheckCircle, XCircle,
  Download, Trash2, Loader2, HardDrive, Replace, Plus, X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useConfigStore } from "../stores/config";
import { ShortcutSelector } from "../components/ShortcutSelector";
import type { SpextConfig, ModelInfo, WhisperModel, WordReplacement } from "../types/config";

export function SettingsPage() {
  const { config, updateConfig } = useConfigStore();
  const [accessibilityGranted, setAccessibilityGranted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<SpextConfig>(config);

  useEffect(() => { setLocalConfig(config); }, [config]);

  // Check accessibility on mount and when window regains focus
  const checkAccess = () => { invoke<boolean>("check_accessibility").then(setAccessibilityGranted); };
  useEffect(() => {
    checkAccess();
    const onFocus = () => checkAccess();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await updateConfig(localConfig); } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const update = (partial: Partial<SpextConfig>) => setLocalConfig((prev) => ({ ...prev, ...partial }));
  const hasChanges = JSON.stringify(localConfig) !== JSON.stringify(config);

  return (
    <div className="h-full flex flex-col t-bg relative noise">
      {/* Header */}
      <div className="drag-region py-3 flex items-center relative z-10" style={{ paddingLeft: 24, paddingRight: 24 }}>
        <div className="no-drag">
          <h1 className="text-base font-bold t-text tracking-tight">Settings</h1>
        </div>
        <div className="flex-1" />
        {hasChanges && (
          <div className="no-drag" style={{ marginRight: 6 }}>
            <motion.button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 press"
              style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)", boxShadow: "0 4px 15px rgba(6,182,212,0.3)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </motion.button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto relative z-10" style={{ padding: "9px 9px", display: "flex", flexDirection: "column", gap: 9 }}>

        <GradientCard>
          <CardHeader icon={<Keyboard size={15} />} title="Shortcut" subtitle="System-wide hold-to-talk key" />
          <div className="mt-3">
            <ShortcutSelector value={localConfig.shortcut} onChange={(s) => update({ shortcut: s })} />
          </div>
        </GradientCard>

        <GradientCard>
          <CardHeader icon={<HardDrive size={15} />} title="Models" subtitle="Download Whisper GGML models" />
          <div className="mt-3">
            <WhisperModelManager selectedModel={localConfig.whisper_model} onSelectModel={(m) => update({ whisper_model: m as WhisperModel })} />
          </div>
        </GradientCard>

        <GradientCard>
          <CardHeader icon={<Globe size={15} />} title="Language" subtitle="Set language or auto-detect" />
          <div className="mt-3">
            <input
              type="text"
              value={localConfig.language}
              onChange={(e) => update({ language: e.target.value })}
              placeholder="en, es, fr, de, ja, zh, auto..."
              className="w-full px-3 py-2 t-bg-t border t-border rounded-xl text-sm t-text focus:outline-none transition-colors"
              style={{ caretColor: "var(--rt-accent)" }}
              onFocus={(e) => e.target.style.borderColor = "rgba(6,182,212,0.4)"}
              onBlur={(e) => e.target.style.borderColor = "var(--rt-border)"}
            />
            <p className="text-[11px] t-text-m mt-1.5">Use "auto" for automatic detection (Whisper only)</p>
          </div>
        </GradientCard>

        <GradientCard>
          <CardHeader icon={<Replace size={15} />} title="Word Replacements" subtitle="Auto-replace words in transcriptions" />
          <div className="mt-3">
            <ReplacementEditor
              replacements={localConfig.replacements || []}
              onChange={(r) => update({ replacements: r })}
            />
          </div>
        </GradientCard>

        <GradientCard>
          <CardHeader icon={<Sparkles size={15} />} title="Smart Keywords" subtitle="Voice-triggered formatting" />
          <div className="mt-3">
            <label className="flex items-center gap-3 cursor-pointer press">
              <motion.div
                className="w-10 h-[22px] rounded-full flex items-center px-[3px] cursor-pointer"
                style={{ background: localConfig.smart_keywords_enabled ? "linear-gradient(90deg, #06b6d4, #3b82f6)" : "var(--rt-bg-hover)", border: localConfig.smart_keywords_enabled ? "none" : "1px solid var(--rt-border)" }}
                onClick={() => update({ smart_keywords_enabled: !localConfig.smart_keywords_enabled })}
              >
                <motion.div
                  className="w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ x: localConfig.smart_keywords_enabled ? 18 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </motion.div>
              <span className="text-sm t-text">Enable smart keywords</span>
            </label>
            <p className="text-[11px] t-text-m mt-2">Say "rephrase as email" or "format as bullet points"</p>
          </div>
        </GradientCard>

        <GradientCard>
          <CardHeader icon={<Sparkles size={15} />} title="Sound Feedback" subtitle="Audio chime on record start/stop" />
          <div className="mt-3">
            <label className="flex items-center gap-3 cursor-pointer press">
              <motion.div
                className="w-10 h-[22px] rounded-full flex items-center px-[3px] cursor-pointer"
                style={{ background: localConfig.chime_enabled ? "linear-gradient(90deg, #06b6d4, #3b82f6)" : "var(--rt-bg-hover)", border: localConfig.chime_enabled ? "none" : "1px solid var(--rt-border)" }}
                onClick={() => update({ chime_enabled: !localConfig.chime_enabled })}
              >
                <motion.div
                  className="w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ x: localConfig.chime_enabled ? 18 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </motion.div>
              <span className="text-sm t-text">Enable beep sound</span>
            </label>
            <p className="text-[11px] t-text-m mt-2">Play a chime when recording starts and stops</p>
            {localConfig.chime_enabled && (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[11px] t-text-m">🔈</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((localConfig.chime_volume ?? 0.5) * 100)}
                  onChange={(e) => update({ chime_volume: parseInt(e.target.value) / 100 })}
                  style={{ flex: 1, accentColor: "#06b6d4", height: 4 }}
                />
                <span className="text-[11px] t-text-m">🔊</span>
                <span className="text-[11px] t-text-m font-mono" style={{ width: 32, textAlign: "right" }}>
                  {Math.round((localConfig.chime_volume ?? 0.5) * 100)}%
                </span>
              </div>
            )}
          </div>
        </GradientCard>

        <GradientCard>
          <CardHeader icon={<Shield size={15} />} title="Permissions" subtitle="Required for text injection" />
          <div className="mt-3">
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{
                background: accessibilityGranted ? "rgba(52,211,153,0.06)" : "rgba(251,113,133,0.06)",
                border: `1px solid ${accessibilityGranted ? "rgba(52,211,153,0.2)" : "rgba(251,113,133,0.2)"}`,
              }}>
              <div className="flex items-center gap-2.5">
                {accessibilityGranted ? <CheckCircle size={16} className="t-success" /> : <XCircle size={16} className="t-error" />}
                <div>
                  <p className="text-sm t-text font-medium">Accessibility</p>
                  <p className="text-[11px] t-text-m">{accessibilityGranted ? "Granted" : "Required for paste"}</p>
                </div>
              </div>
              {!accessibilityGranted && (
                <motion.button
                  onClick={() => invoke("open_accessibility_settings")}
                  className="px-3 py-1.5 text-xs text-white rounded-lg font-medium press"
                  style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Grant
                </motion.button>
              )}
            </div>
          </div>
        </GradientCard>
      </div>
    </div>
  );
}

function GradientCard({ children }: { children: React.ReactNode }) {
  return <div className="gradient-border p-4">{children}</div>;
}

function CardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.15))" }}>
        <span className="t-accent">{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "var(--rt-accent)" }}>{title}</h3>
        <p className="text-[11px] t-text-m">{subtitle}</p>
      </div>
    </div>
  );
}

function WhisperModelManager({ selectedModel, onSelectModel }: { selectedModel: string; onSelectModel: (m: string) => void }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const loadModels = () => { invoke<ModelInfo[]>("list_whisper_models").then(setModels); };
  useEffect(() => { loadModels(); }, []);
  useEffect(() => {
    const u = listen<{ model_id: string; progress: number; status: string }>("model-download-progress", (e) => {
      if (e.payload.status === "complete") { setDownloading(null); setProgress(0); loadModels(); }
      else if (e.payload.progress >= 0) setProgress(e.payload.progress);
    });
    return () => { u.then((fn) => fn()); };
  }, []);
  return (
    <div className="grid grid-cols-3 gap-2">
      {models.map((m) => (
        <ModelCard key={m.id} model={m} isSelected={selectedModel === m.id} isDownloading={downloading === m.id}
          downloadProgress={downloading === m.id ? progress : 0}
          onSelect={() => onSelectModel(m.id)}
          onDownload={() => { setDownloading(m.id); setProgress(0); invoke("download_whisper_model", { modelId: m.id }).catch(() => setDownloading(null)); }}
          onDelete={() => { invoke("delete_whisper_model_cmd", { modelId: m.id }).then(loadModels); }}
        />
      ))}
    </div>
  );
}

function ModelCard({ model, isSelected, isDownloading, downloadProgress, onSelect, onDownload, onDelete }: {
  model: ModelInfo; isSelected: boolean; isDownloading: boolean; downloadProgress: number;
  onSelect: () => void; onDownload: () => void; onDelete: () => void;
}) {
  return (
    <motion.div
      className="relative p-3 rounded-xl transition-all press cursor-pointer"
      style={{
        background: isSelected
          ? "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(59,130,246,0.08))"
          : model.downloaded ? "var(--rt-bg-tertiary)" : "var(--rt-bg-primary)",
        border: isSelected
          ? "1px solid rgba(6,182,212,0.35)"
          : model.downloaded ? "1px solid var(--rt-border)" : "1px dashed var(--rt-border)",
        opacity: model.downloaded ? 1 : 0.6,
      }}
      onClick={() => model.downloaded && onSelect()}
      whileHover={{ scale: 1.02, opacity: 1 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Progress */}
      {isDownloading && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl overflow-hidden" style={{ background: "var(--rt-bg-hover)" }}>
          <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6)", width: `${downloadProgress}%` }} />
        </div>
      )}

      {/* Selection dot */}
      <div className="flex items-center justify-between mb-2">
        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
          isSelected ? "border-cyan-400" : "t-border"
        }`} style={isSelected ? { background: "linear-gradient(135deg, #06b6d4, #3b82f6)" } : {}}>
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        {/* Action */}
        {isDownloading ? (
          <Loader2 size={12} className="t-accent animate-spin" />
        ) : model.downloaded ? (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="t-text-m hover:t-error transition-colors">
            <Trash2 size={11} />
          </button>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onDownload(); }} className="t-accent">
            <Download size={12} />
          </button>
        )}
      </div>

      {/* Name */}
      <p className="text-xs font-semibold leading-tight" style={{ color: "#ffffff" }}>
        {model.name}
      </p>

      {isDownloading && (
        <p className="text-[9px] t-accent font-mono mt-1">{downloadProgress}%</p>
      )}
    </motion.div>
  );
}

function ReplacementEditor({ replacements, onChange }: { replacements: WordReplacement[]; onChange: (r: WordReplacement[]) => void }) {
  const addRule = () => {
    onChange([...replacements, { from: "", to: "" }]);
  };

  const updateRule = (index: number, field: "from" | "to", value: string) => {
    const updated = [...replacements];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeRule = (index: number) => {
    onChange(replacements.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {replacements.map((rule, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={rule.from}
            onChange={(e) => updateRule(i, "from", e.target.value)}
            placeholder="When I say..."
            className="flex-1 px-2.5 py-1.5 t-bg-t border t-border rounded-lg text-xs t-text focus:outline-none transition-colors"
            style={{ caretColor: "var(--rt-accent)" }}
            onFocus={(e) => e.target.style.borderColor = "rgba(6,182,212,0.4)"}
            onBlur={(e) => e.target.style.borderColor = "var(--rt-border)"}
          />
          <span className="t-text-m text-xs">→</span>
          <input
            type="text"
            value={rule.to}
            onChange={(e) => updateRule(i, "to", e.target.value)}
            placeholder="Replace with..."
            className="flex-1 px-2.5 py-1.5 t-bg-t border t-border rounded-lg text-xs t-text focus:outline-none transition-colors"
            style={{ caretColor: "var(--rt-accent)" }}
            onFocus={(e) => e.target.style.borderColor = "rgba(6,182,212,0.4)"}
            onBlur={(e) => e.target.style.borderColor = "var(--rt-border)"}
          />
          <button
            onClick={() => removeRule(i)}
            className="p-1 rounded-lg t-text-m hover:t-error transition-colors press"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <motion.button
        onClick={addRule}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium t-accent press"
        style={{ background: "rgba(6,182,212,0.08)", border: "1px dashed rgba(6,182,212,0.3)" }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
      >
        <Plus size={12} />
        Add replacement
      </motion.button>
      <p className="text-[10px] t-text-m">
        Words on the left will be replaced with text on the right. Case-insensitive. E.g., "colon" → ":"
      </p>
    </div>
  );
}
