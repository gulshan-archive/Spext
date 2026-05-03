import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, WifiOff, Zap, Globe, Type } from "lucide-react";
import { useRecordingStore } from "../stores/recording";
import { useConfigStore } from "../stores/config";
import { LiveWaveform } from "../components/LiveWaveform";

export function HomePage() {
  const { phase, audioLevel, durationSecs, error } = useRecordingStore();
  const { config } = useConfigStore();
  const [testText, setTestText] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  // No programmatic append needed — the text injection uses clipboard+paste
  // which automatically types into the focused textarea via OS-level Cmd+V

  const isRecording = phase === "recording";
  const isProcessing = phase === "processing";
  const isSuccess = phase === "success";
  const isError = phase === "error";

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col t-bg relative noise overflow-hidden">
      {/* Ambient background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{
            top: "20%", left: "30%",
            background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
            animation: "float1 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{
            top: "40%", left: "55%",
            background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
            animation: "float2 15s ease-in-out infinite",
          }}
        />
        {isRecording && (
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              top: "15%", left: "25%",
              background: "radial-gradient(circle, #06b6d4 0%, transparent 60%)",
            }}
            animate={{ opacity: [0.05, 0.12, 0.05], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>

      {/* Top bar */}
      <div className="drag-region flex items-center justify-between relative z-10" style={{ padding: "13px 9px" }}>
        <div className="no-drag flex items-center gap-2">
          <img src="/spext-icon.svg" alt="Spext" width={22} height={22} style={{ borderRadius: 5 }} />
          <div>
            <span className="text-base font-bold t-text tracking-tight block">Spext</span>
            <span className="text-[11px] block" style={{ marginTop: -2, color: "#c0c8d4" }}>Offline · CPU‑only · Runs anywhere</span>
          </div>
        </div>
        <div className="flex items-center gap-2 no-drag">
          <span className="text-[9px] t-text-m">v0.1.0</span>
          <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
            isRecording ? "bg-red-500 shadow-lg shadow-red-500/50" : isProcessing ? "bg-cyan-400 shadow-lg shadow-cyan-400/50" : "bg-emerald-500"
          }`} />
          <span className="text-[11px] t-text-m">
            {isRecording ? "Recording" : isProcessing ? "Processing" : "Ready"}
          </span>
        </div>
      </div>

      {/* Center area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        {/* Mic orb — larger with dramatic gradient */}
        <div className="relative mb-8">
          {/* Outer glow rings */}
          {isRecording && (
            <>
              <motion.div
                className="absolute inset-[-24px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)" }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-[-8px] rounded-full"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)" }}
                animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
              />
            </>
          )}

          <motion.div
            className="relative w-[110px] h-[110px] rounded-full flex items-center justify-center cursor-default overflow-hidden"
            style={{
              background: isRecording
                ? "linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #8b5cf6 100%)"
                : isProcessing
                  ? "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)"
                  : isSuccess
                    ? "linear-gradient(135deg, #34d399 0%, #059669 100%)"
                    : isError
                      ? "linear-gradient(135deg, #fb7185 0%, #e11d48 100%)"
                      : "var(--rt-bg-tertiary)",
              boxShadow: isRecording
                ? "0 0 60px rgba(6,182,212,0.3), 0 0 120px rgba(59,130,246,0.15), inset 0 1px 1px rgba(255,255,255,0.1)"
                : isProcessing
                  ? "0 0 40px rgba(6,182,212,0.2), inset 0 1px 1px rgba(255,255,255,0.1)"
                  : isSuccess
                    ? "0 0 40px rgba(52,211,153,0.2)"
                    : "none",
              border: phase === "idle" ? "1px solid var(--rt-border)" : "none",
            }}
            animate={isRecording ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={isRecording ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.4 }}
          >
            {/* Inner shine */}
            {phase !== "idle" && (
              <div className="absolute inset-0 rounded-full"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
            )}
            <Mic
              size={32}
              className={phase === "idle" ? "t-text-m" : "text-white"}
              strokeWidth={1.6}
              style={{ position: "relative", zIndex: 1 }}
            />
          </motion.div>

          {/* Expanding pulse rings */}
          {isRecording && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: "1.5px solid rgba(6,182,212,0.4)" }}
                animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: "1px solid rgba(59,130,246,0.3)" }}
                animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
              />
            </>
          )}
        </div>

        {/* Status text */}
        <div className="text-center mb-6 h-12 flex flex-col justify-center">
          {isRecording && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm font-bold tracking-[0.2em] uppercase"
                style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Listening
              </p>
              <p className="t-text-m text-xs font-mono mt-1">{formatDuration(durationSecs)}</p>
            </motion.div>
          )}
          {isProcessing && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-semibold"
              style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Transcribing...
            </motion.p>
          )}
          {isSuccess && (
            <motion.p initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-sm font-semibold t-success">
              Text injected ✓
            </motion.p>
          )}
          {isError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs t-error">{error}</motion.p>
          )}
          {phase === "idle" && (
            <p className="t-text-s text-base">
              Hold{" "}
              <kbd className="px-2 py-0.5 glass rounded-md text-sm font-mono t-accent">{config.shortcut}</kbd>
              {" "}to speak
            </p>
          )}
        </div>

        {/* Waveform */}
        <div className="h-10 mb-6">
          {isRecording ? (
            <LiveWaveform audioLevel={audioLevel} isActive={true} width={240} height={36} color="#06b6d4" />
          ) : (
            <div className="w-[240px] h-[36px] flex items-center justify-center">
              <div className="w-full h-[1px] rounded" style={{ background: "linear-gradient(90deg, transparent, var(--rt-border), transparent)" }} />
            </div>
          )}
        </div>

        {/* Feature pills — glass morphism */}
        {phase === "idle" && (
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassPill icon={<Zap size={11} />} text="Hold to Talk" />
            <GlassPill icon={<WifiOff size={11} />} text="Offline" />
            <GlassPill icon={<Globe size={11} />} text="100+ Languages" />
          </motion.div>
        )}
      </div>

      {/* Output area */}
      <div className="relative z-10 border-t t-border" style={{ padding: "11px 9px 15px 9px" }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Type size={11} style={{ color: "var(--rt-accent)" }} />
            <span className="text-sm font-semibold tracking-wider" style={{ color: "var(--rt-accent)" }}>
              Test Output
            </span>
            {isFocused && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium"
                style={{ background: "linear-gradient(90deg, #06b6d4, #3b82f6)" }}>
                Active
              </span>
            )}
          </div>
          {testText && (
            <button onClick={() => setTestText("")} className="text-[10px] t-text-m hover:t-accent transition-colors press">Clear</button>
          )}
        </div>
        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFocused ? "Speak now — text appears here..." : "Click here to capture transcriptions"}
          className={`w-full p-3 t-bg-s rounded-2xl text-sm t-text font-mono resize-none focus:outline-none leading-relaxed transition-all ${
            isFocused ? "shadow-inner" : ""
          }`}
          style={{
            height: 130,
            border: isFocused ? "1px solid rgba(6,182,212,0.4)" : "1px solid var(--rt-border)",
            boxShadow: isFocused ? "inset 0 2px 8px rgba(0,0,0,0.2), 0 0 0 3px rgba(6,182,212,0.08)" : "inset 0 1px 3px rgba(0,0,0,0.1)",
            caretColor: "var(--rt-accent)",
          }}
        />
      </div>
    </div>
  );
}

function GlassPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="glass flex items-center gap-1.5 px-3 py-1.5 rounded-full press cursor-default">
      <span className="t-text-m">{icon}</span>
      <span className="text-[10px] font-medium t-text-s">{text}</span>
    </div>
  );
}
