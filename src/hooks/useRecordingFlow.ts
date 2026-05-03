import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useRecordingStore } from "../stores/recording";
import { useConfigStore } from "../stores/config";
import { playStartChime, playStopChime } from "./useRecordingChime";

/**
 * Hook that listens to Rust recording events and updates the store.
 * Should be mounted once at the app root level.
 */
export function useRecordingFlow() {
  const {
    setPhase,
    setAudioLevel,
    setError,
    setLastTranscription,
    phase,
    audioLevel,
    durationSecs,
    error,
    lastTranscription,
  } = useRecordingStore();

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    const setup = async () => {
      // Recording started
      unlisteners.push(
        await listen("recording-started", () => {
          setPhase("recording");
          setError(null);
          if (useConfigStore.getState().config.chime_enabled) playStartChime(useConfigStore.getState().config.chime_volume);
          // Start duration counter
          const store = useRecordingStore.getState();
          store.setDuration(0);
          durationRef.current = setInterval(() => {
            const s = useRecordingStore.getState();
            s.setDuration(s.durationSecs + 0.1);
          }, 100);
        })
      );

      // Audio level updates (for waveform)
      unlisteners.push(
        await listen<number>("audio-level", (event) => {
          setAudioLevel(event.payload);
        })
      );

      // Processing started
      unlisteners.push(
        await listen("processing-started", () => {
          setPhase("processing");
          if (useConfigStore.getState().config.chime_enabled) playStopChime(useConfigStore.getState().config.chime_volume);
          if (durationRef.current) {
            clearInterval(durationRef.current);
            durationRef.current = null;
          }
        })
      );

      // AI processing in progress
      unlisteners.push(
        await listen<string>("processing-ai", () => {
          // Could show a specific AI processing indicator
        })
      );

      // Recording success
      unlisteners.push(
        await listen<string>("recording-success", (event) => {
          setPhase("success");
          setLastTranscription(event.payload);
          // Auto-reset to idle after 5 seconds
          setTimeout(() => {
            setPhase("idle");
          }, 5000);
        })
      );

      // Recording error
      unlisteners.push(
        await listen<string>("recording-error", (event) => {
          setPhase("error");
          setError(event.payload);
          if (durationRef.current) {
            clearInterval(durationRef.current);
            durationRef.current = null;
          }
          // Auto-reset to idle after 3 seconds
          setTimeout(() => {
            setPhase("idle");
            setError(null);
          }, 3000);
        })
      );
    };

    setup();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
      if (durationRef.current) {
        clearInterval(durationRef.current);
      }
    };
  }, []);

  return { phase, audioLevel, durationSecs, error, lastTranscription };
}
