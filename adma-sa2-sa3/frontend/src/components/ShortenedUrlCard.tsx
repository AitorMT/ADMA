import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { ShortUrl } from "@/lib/api";

interface ShortenedUrlCardProps {
  shortUrl: ShortUrl;
}

const ShortenedUrlCard = ({ shortUrl }: ShortenedUrlCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shortUrl.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card glow-border p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-primary font-medium text-sm">
              {shortUrl.shortUrl}
            </span>
            <a
              href={`/r/${shortUrl.shortCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {shortUrl.originalUrl}
          </p>
        </div>

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
  );
};

export default ShortenedUrlCard;
