import { useEffect, useRef } from "react";

interface LiveWaveformProps {
  audioLevel: number;
  isActive: boolean;
  width?: number;
  height?: number;
  color?: string;
}

/**
 * Canvas-based live waveform that reacts to audio level.
 * Renders animated bars that bounce with the microphone input.
 */
export function LiveWaveform({
  audioLevel,
  isActive,
  width = 200,
  height = 48,
  color = "#ef4444",
}: LiveWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const levelRef = useRef(0);

  // Smooth the audio level
  useEffect(() => {
    if (isActive) {
      levelRef.current = levelRef.current * 0.5 + audioLevel * 0.5;
    } else {
      levelRef.current = 0;
    }
  }, [audioLevel, isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      if (!isActive) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const level = levelRef.current;
      const barCount = Math.floor(w / 6);
      const barWidth = 3;
      const gap = 3;
      const totalWidth = barCount * (barWidth + gap) - gap;
      const startX = (w - totalWidth) / 2;

      for (let i = 0; i < barCount; i++) {
        const t = Date.now() / 120 + i * 0.6;
        const wave = Math.sin(t) * 0.3 + 0.5;
        const noise = Math.sin(t * 2.3 + i) * 0.2;
        const barH = Math.max(
          2,
          (level * 120 + wave * 8 + noise * 4) * (0.3 + Math.random() * 0.7)
        );
        const clampedH = Math.min(barH, h - 2);
        const x = startX + i * (barWidth + gap);
        const y = (h - clampedH) / 2;

        const alpha = Math.min(1, 0.3 + level * 1.5);
        ctx.fillStyle = color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
        // Fallback for hex colors
        if (color.startsWith("#")) {
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, clampedH, 1.5);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
}
