import { z } from "zod";

export const WhisperModelSchema = z.enum([
  "tiny",
  "tiny_en",
  "base",
  "base_en",
  "small",
  "small_en",
  "medium",
  "medium_en",
  "large_v3",
  "large_v3_turbo",
]);
export type WhisperModel = z.infer<typeof WhisperModelSchema>;

export interface WordReplacement {
  from: string;
  to: string;
}

export const SpextConfigSchema = z.object({
  shortcut: z.string().default("Alt+Space"),
  language: z.string().default("en"),
  whisper_model: WhisperModelSchema.default("base"),
  smart_keywords_enabled: z.boolean().default(false),
  copy_to_clipboard: z.boolean().default(true),
  chime_enabled: z.boolean().default(true),
  chime_volume: z.number().min(0).max(1).default(0.5),
  replacements: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
});

export type SpextConfig = z.infer<typeof SpextConfigSchema>;

export interface ModelInfo {
  id: string;
  name: string;
  engine: string;
  size_display: string;
  downloaded: boolean;
  path: string | null;
}
