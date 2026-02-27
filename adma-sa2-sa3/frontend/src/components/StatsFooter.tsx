import { useStats, useCountUp } from "@/hooks/use-stats";

/**
 * Formats a large number with k/M suffixes for compact display.
 * e.g. 2_400_000 → "2.4M", 15_300 → "15.3k", 42 → "42"
 */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/** Single animated stat card. */
function StatItem({
  value,
  label,
  loading,
}: {
  value: string;
  label: string;
  loading: boolean;
}) {
  return (
    <div className="text-center">
      <p
        className={`text-xl font-semibold text-foreground transition-opacity duration-300 ${
          loading ? "opacity-30" : "opacity-100"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

/**
 * Displays three live platform stats fetched from the backend:
 *  - Total links created
 *  - Total redirects served
 *  - Average redirect latency
 *
 * All values animate smoothly when data arrives or updates.
 * Falls back to "—" while loading / unavailable.
 */
export default function StatsFooter() {
  const { stats, loading } = useStats();

  const totalLinks = useCountUp(stats?.totalLinks ?? 0);
  const totalRedirects = useCountUp(stats?.totalRedirects ?? 0);
  // latency is a small float — animate to tenths
  const latencyRaw = useCountUp(
    stats?.avgLatencyMs != null ? Math.round(stats.avgLatencyMs) : 0,
  );

  const linksLabel = loading ? "—" : formatCompact(totalLinks) + "+";
  const redirectsLabel = loading ? "—" : formatCompact(totalRedirects) + "+";
  const latencyLabel = loading
    ? "—"
    : stats?.avgLatencyMs != null
      ? `< ${latencyRaw + 1} ms` // +1 so we never show "< 0 ms" on first redirect
      : "< 50 ms"; // shown only when no redirect data yet

  return (
    <>
      <StatItem value={linksLabel} label="Enlaces creados" loading={loading} />
      <StatItem
        value={redirectsLabel}
        label="Redirecciones servidas"
        loading={loading}
      />
      <StatItem
        value={latencyLabel}
        label="Velocidad de redirección"
        loading={loading}
      />
    </>
  );
}
