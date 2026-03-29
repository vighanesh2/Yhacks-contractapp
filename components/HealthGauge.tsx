"use client";

import { useEffect, useState } from "react";

export function HealthGauge({
  score,
  size = 112,
  className = "",
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const [display, setDisplay] = useState(0);
  const r = (size / 2) * 0.72;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    const start = performance.now();
    const duration = 1000;
    let frame: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(clamped * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  const color =
    clamped >= 70 ? "text-emerald-500" : clamped >= 40 ? "text-amber-500" : "text-red-500";

  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-gray-200"
          strokeWidth={size * 0.08}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={color}
          strokeWidth={size * 0.08}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - display / 100)}
          style={{ transition: "stroke-dashoffset 0.15s ease-out" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{display}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
          health
        </span>
      </div>
    </div>
  );
}
