"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a displayed number toward `target` (easing). Used for stat cards.
 */
export function useCountUp(target: number, durationMs = 850): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const next = from + (target - from) * eased;
      setValue(next);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, durationMs]);

  return value;
}
