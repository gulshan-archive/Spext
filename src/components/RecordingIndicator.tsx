import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Check, AlertCircle } from "lucide-react";
import { LiveWaveform } from "./LiveWaveform";
import type { RecordingPhase } from "../types/recording";

interface RecordingIndicatorProps {
  phase: RecordingPhase;
  audioLevel: number;
  durationSecs: number;
  error: string | null;
  lastTranscription: string | null;
}

export function RecordingIndicator({
  phase,
  audioLevel,
  durationSecs,
  error,
  lastTranscription,
}: RecordingIndicatorProps) {
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence mode="wait">
      {phase === "recording" && (
        <motion.div
          key="recording"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex flex-col items-center gap-6"
        >
          {/* Pulsing mic with red ring */}
          <div className="relative">
            <motion.div
              className="w-24 h-24 rounded-full bg-error/10 flex items-center justify-center border-2 border-error/30"
              animate={{ scale: [1, 1.06, 1], borderColor: ["rgba(239,68,68,0.3)", "rgba(239,68,68,0.6)", "rgba(239,68,68,0.3)"] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Mic size={36} className="t-error" />
            </motion.div>
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            />
          </div>

          {/* Live waveform */}
          <LiveWaveform
            audioLevel={audioLevel}
            isActive={true}
            width={280}
            height={56}
            color="#ef4444"
          />

          {/* Timer */}
          <div className="text-center">
            <p className="t-text font-medium text-lg">Recording...</p>
            <p className="t-text-m text-sm font-mono mt-1">
              {formatDuration(durationSecs)}
            </p>
          </div>
        </motion.div>
      )}

      {phase === "processing" && (
        <motion.div
          key="processing"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center">
            <Loader2 size={32} className="t-accent animate-spin" />
          </motion.div>
          <p className="t-text font-medium">Transcribing...</p>
        </motion.div>
      )}

      {phase === "success" && (
        <motion.div
          key="success"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <Check size={32} className="t-success" />
          </motion.div>
          <div className="text-center max-w-md">
            <p className="t-success font-medium mb-2">Text injected</p>
            {lastTranscription && (
              <p className="t-text-s text-sm leading-relaxed">
                "{lastTranscription}"
              </p>
            )}
          </div>
        </motion.div>
      )}

      {phase === "error" && (
        <motion.div
          key="error"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center">
            <AlertCircle size={32} className="t-error" />
          </div>
          <div className="text-center max-w-md">
            <p className="t-error font-medium">Error</p>
            {error && (
              <p className="t-text-m text-sm mt-1">{error}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
