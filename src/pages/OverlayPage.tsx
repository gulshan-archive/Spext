import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";

export function OverlayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const animRef = useRef(0);
  const [targetApp, setTargetApp] = useState("");

  // Parse target app from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const app = params.get("app") || "";
    setTargetApp(decodeURIComponent(app));
  }, []);

  // Force dark background
  useEffect(() => {
    document.documentElement.style.background = "#0e1118";
    document.body.style.background = "#0e1118";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    const root = document.getElementById("root");
    if (root) {
      root.style.background = "#0e1118";
      root.style.height = "100%";
    }
  }, []);

  // Listen for audio levels
  useEffect(() => {
    const unlisten = listen<number>("audio-level", (e) => {
      levelRef.current = levelRef.current * 0.5 + e.payload * 0.5;
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Animate waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const level = levelRef.current;
      const barCount = 20;
      const barW = 3;
      const gap = 2;
      const totalW = barCount * (barW + gap) - gap;
      const startX = (w - totalW) / 2;

      for (let i = 0; i < barCount; i++) {
        const t = Date.now() / 120 + i * 0.6;
        const wave = Math.sin(t) * 0.3 + 0.5;
        const barH = Math.max(3, (level * 120 + wave * 6) * (0.3 + Math.random() * 0.7));
        const clamped = Math.min(barH, h - 4);
        const x = startX + i * (barW + gap);
        const y = (h - clamped) / 2;
        const alpha = 0.4 + level * 0.6;
        ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, clamped, 1.5);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "#0e1118",
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 8,
    }}>
      {/* App name + Spext label */}
      <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, minWidth: 60, maxWidth: 80 }}>
        <span style={{ color: "#06b6d4", fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>SPEXT</span>
        {targetApp && (
          <span style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: 8,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            → {targetApp}
          </span>
        )}
      </div>

      {/* Red dot */}
      <div style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#ef4444",
        flexShrink: 0,
        animation: "pulse 0.8s ease-in-out infinite alternate",
      }} />

      {/* Waveform */}
      <canvas ref={canvasRef} width={140} height={36} style={{ flexShrink: 0 }} />

      <style>{`@keyframes pulse { from { opacity: 1; } to { opacity: 0.3; } }`}</style>
    </div>
  );
}
