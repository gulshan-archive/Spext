import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface WaveformVisualizerProps {
  audioLevel: number;
  isActive: boolean;
}

export function WaveformVisualizer({ audioLevel, isActive }: WaveformVisualizerProps) {
  const barsCount = 24;
  const barsRef = useRef<number[]>(new Array(barsCount).fill(0));

  useEffect(() => {
    if (isActive) {
      // Shift bars left and add new level on the right
      barsRef.current = [
        ...barsRef.current.slice(1),
        Math.min(audioLevel * 3, 1), // Normalize and cap
      ];
    }
  }, [audioLevel, isActive]);

  const bars = isActive ? barsRef.current : new Array(barsCount).fill(0);

  return (
    <div className="flex items-center gap-[2px] h-10">
      {bars.map((level, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full bg-accent"
          animate={{
            height: isActive ? Math.max(4, level * 40) : 4,
            opacity: isActive ? 0.4 + level * 0.6 : 0.2,
          }}
          transition={{ duration: 0.1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
