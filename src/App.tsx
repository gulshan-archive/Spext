import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useConfigStore } from "./stores/config";
import { useRecordingFlow } from "./hooks/useRecordingFlow";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const { loadConfig } = useConfigStore();

  useRecordingFlow();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
