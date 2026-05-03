import { create } from "zustand";
import type { RecordingPhase, RecordingState } from "../types/recording";

interface RecordingStore extends RecordingState {
  setPhase: (phase: RecordingPhase) => void;
  setAudioLevel: (level: number) => void;
  setDuration: (secs: number) => void;
  setError: (error: string | null) => void;
  setLastTranscription: (text: string | null) => void;
  reset: () => void;
}

const initialState: RecordingState = {
  phase: "idle",
  audioLevel: 0,
  durationSecs: 0,
  error: null,
  lastTranscription: null,
};

export const useRecordingStore = create<RecordingStore>((set) => ({
  ...initialState,
  setPhase: (phase) => set({ phase }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setDuration: (secs) => set({ durationSecs: secs }),
  setError: (error) => set({ error, phase: error ? "error" : "idle" }),
  setLastTranscription: (text) => set({ lastTranscription: text }),
  reset: () => set(initialState),
}));
