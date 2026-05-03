import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { SpextConfigSchema, type SpextConfig } from "../types/config";

interface ConfigStore {
  config: SpextConfig;
  isLoading: boolean;
  loadConfig: () => Promise<void>;
  updateConfig: (partial: Partial<SpextConfig>) => Promise<void>;
  setConfig: (config: SpextConfig) => void;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: SpextConfigSchema.parse({}),
  isLoading: true,

  loadConfig: async () => {
    try {
      const raw = await invoke<SpextConfig>("get_config");
      const config = SpextConfigSchema.parse(raw);
      set({ config, isLoading: false });
    } catch (e) {
      console.error("Failed to load config:", e);
      set({ isLoading: false });
    }
  },

  updateConfig: async (partial) => {
    const current = get().config;
    const updated = { ...current, ...partial };
    try {
      await invoke("set_config", { config: updated });
      set({ config: updated });
    } catch (e) {
      console.error("Failed to update config:", e);
      throw e;
    }
  },

  setConfig: (config) => set({ config }),
}));
