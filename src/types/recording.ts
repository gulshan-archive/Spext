export type RecordingPhase =
  | "idle"
  | "recording"
  | "processing"
  | "success"
  | "error";

export interface RecordingState {
  phase: RecordingPhase;
  audioLevel: number;
  durationSecs: number;
  error: string | null;
  lastTranscription: string | null;
}
