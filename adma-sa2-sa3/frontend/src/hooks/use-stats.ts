import { useState, useEffect, useRef } from "react";
import { getStats, type PlatformStats } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000; // refresh every 60 s

/**
 * Fetches live platform stats from the backend and keeps them fresh.
 * Returns the latest data plus a loading flag.
 */
export function useStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch {
      // Non-critical — keep showing previous data or nothing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { stats, loading };
}

// ── Animated counter ──────────────────────────────────────────────────────────

/**
 * Smoothly animates a number from 0 (or previous value) to `target`
 * over `duration` ms using requestAnimationFrame.
 */
export function useCountUp(target: number, duration = 1200): number {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) {
      setDisplay(0);
      return;
    }

    fromRef.current = display;
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const progress = Math.min((now - startRef.current) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(
        Math.round(fromRef.current + (target - fromRef.current) * eased),
      );
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}
