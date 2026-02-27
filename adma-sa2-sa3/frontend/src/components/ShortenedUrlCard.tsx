import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  ExternalLink,
  Calendar,
  Clock,
  Trash2,
  BarChart2,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ShortUrl } from "@/lib/api";

interface ShortenedUrlCardProps {
  shortUrl: ShortUrl;
  /** ISO 8601 expiry timestamp. When provided, shows a TTL badge (anonymous URLs). */
  expiresAt?: string;
  /** Called when the authenticated user deletes the link. */
  onDelete?: (id: number) => void;
}

/**
 * Displays a single shortened URL with copy, analytics, and (for authenticated
 * users) a delete action.
 *
 * Shows:
 *  - Short URL + original URL
 *  - Creation date
 *  - Expiry countdown for temporary (anonymous) links
 *  - Redirect count + average latency (real backend data)
 *  - Destination availability status code
 *  - Delete button (only when onDelete is provided, i.e. authenticated)
 */
const ShortenedUrlCard = ({
  shortUrl,
  expiresAt,
  onDelete,
}: ShortenedUrlCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shortUrl.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(shortUrl.createdAt).toLocaleDateString(
    "es-ES",
    { day: "2-digit", month: "short", year: "numeric" },
  );

  /** Human-readable time remaining until expiry */
  const expiryLabel = (() => {
    const exp = expiresAt ?? shortUrl.expiresAt;
    if (!exp) return null;
    const diff = new Date(exp).getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `Expira en ${hours}h ${minutes}m`;
    return `Expira en ${minutes}m`;
  })();

  const avgMs = shortUrl.avgRedirectMs;
  const destOk =
    shortUrl.destinationStatus != null && shortUrl.destinationStatus < 400;

  return (
    <div className="glass-card glow-border p-5">
      <div className="flex items-start justify-between gap-4">
        {/* ── Left: URL info ─────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <a
              href={shortUrl.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary font-medium text-sm hover:underline"
            >
              {shortUrl.shortUrl}
            </a>
            <a
              href={shortUrl.shortUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Abrir enlace corto"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground truncate mb-2">
            {shortUrl.originalUrl}
          </p>

          {/* ── Metadata row ──────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground/60">
            {/* Creation date */}
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formattedDate}
            </span>

            {/* Expiry badge — only for temporary links */}
            {expiryLabel && (
              <span className="flex items-center gap-1 text-amber-500/80">
                <Clock className="w-3 h-3" />
                {expiryLabel}
              </span>
            )}

            {/* Redirect count + avg latency */}
            {shortUrl.redirectCount > 0 && (
              <span className="flex items-center gap-1">
                <BarChart2 className="w-3 h-3" />
                {shortUrl.redirectCount}{" "}
                {shortUrl.redirectCount === 1 ? "visita" : "visitas"}
                {avgMs != null && (
                  <span className="ml-0.5 text-muted-foreground/40">
                    · {Math.round(avgMs)}ms
                  </span>
                )}
              </span>
            )}

            {/* Destination availability */}
            {shortUrl.destinationStatus != null && (
              <span
                className={`flex items-center gap-1 ${destOk ? "text-emerald-500/70" : "text-destructive/70"}`}
              >
                {destOk ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {shortUrl.destinationStatus}
              </span>
            )}
          </div>
        </div>

        {/* ── Right: actions ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Delete (authenticated only) */}
          {onDelete && (
            <motion.button
              onClick={() => onDelete(shortUrl.id)}
              whileTap={{ scale: 0.92 }}
              className="p-2 rounded-lg border border-border/30 bg-secondary/30 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              title="Eliminar enlace"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </motion.button>
          )}

          {/* Copy */}
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex items-center gap-1.5 text-primary"
                >
                  <Check className="w-3.5 h-3.5" />
                  Copiado
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ShortenedUrlCard;
