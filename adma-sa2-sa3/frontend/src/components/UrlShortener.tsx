/**
 * UrlShortener
 * ─────────────────────────────────────────────────────────────────────────────
 * Main page component. Works in two modes:
 *
 * ① Anonymous mode (no JWT):
 *    - Calls POST /api/urls/public (no auth)
 *    - Persists the response in localStorage with a 24-hour TTL via localUrlStore
 *    - Shows a banner prompting the user to register/login to save URLs permanently
 *
 * ② Authenticated mode (valid JWT):
 *    - Calls POST /api/urls (authenticated)
 *    - Loads URL history from GET /api/urls
 *    - URLs are stored in the backend with no expiry
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LogOut, RefreshCw, Clock, UserPlus } from "lucide-react";
import {
  createShortUrl,
  createAnonShortUrl,
  listShortUrls,
  deleteShortUrl,
  ApiError,
  type ShortUrl,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  getValidAnonUrls,
  saveAnonUrl,
  type AnonShortUrl,
} from "@/lib/localUrlStore";
import ShortenedUrlCard from "@/components/ShortenedUrlCard";
import StatsFooter from "@/components/StatsFooter";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Union type used in the history list — authenticated ShortUrl or anonymous AnonShortUrl */
type HistoryItem =
  | ({ kind: "auth" } & ShortUrl)
  | ({ kind: "anon" } & AnonShortUrl);

const UrlShortener = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Load history ──────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    if (token) {
      // Authenticated: load from backend
      setHistoryLoading(true);
      try {
        const urls = await listShortUrls(token);
        setHistory(urls.map((u) => ({ kind: "auth" as const, ...u })));
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 401)) {
          console.error("Failed to fetch URL history", err);
        }
      } finally {
        setHistoryLoading(false);
      }
    } else {
      // Anonymous: load from localStorage
      const anonUrls = getValidAnonUrls();
      setHistory(anonUrls.map((u) => ({ kind: "anon" as const, ...u })));
    }
  }, [token]);

  // Initial load + reload when auth state changes
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Basic URL validation before hitting the network
    try {
      new URL(url);
    } catch {
      setError(
        "Por favor, ingresa una URL válida (debe comenzar con http:// o https://)",
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      if (token) {
        // ── Authenticated path ────────────────────────────────────────────
        const shortened = await createShortUrl(url, token);
        setHistory((prev) => [{ kind: "auth", ...shortened }, ...prev]);
      } else {
        // ── Anonymous path ────────────────────────────────────────────────
        const shortened = await createAnonShortUrl(url);
        const stored = saveAnonUrl(
          shortened.originalUrl,
          shortened.shortCode,
          shortened.shortUrl,
        );
        setHistory((prev) => [{ kind: "anon", ...stored }, ...prev]);
      }
      setUrl("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No se pudo conectar con el servidor. Inténtalo más tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Delete (authenticated users only) ────────────────────────────────────

  const handleDelete = useCallback(
    async (id: number) => {
      if (!token) return;
      try {
        await deleteShortUrl(id, token);
        setHistory((prev) =>
          prev.filter((item) => !(item.kind === "auth" && item.id === id)),
        );
      } catch (err) {
        console.error("Failed to delete URL", err);
      }
    },
    [token],
  );

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      {/* Background effects */}
      <div className="absolute inset-0 dot-pattern opacity-30" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.04]"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(14 85% 56%), transparent 70%)",
        }}
      />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto"
      >
        <Link to="/">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-gradient">otakudojo</span>
            <span className="text-foreground">.es</span>
          </h1>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:block">
                Hola,{" "}
                <span className="text-foreground font-medium">{user.name}</span>
              </span>
              <button
                onClick={handleLogout}
                className="btn-ghost text-sm py-2 px-4 flex items-center gap-2"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost text-sm py-2 px-4">
                Iniciar sesión
              </Link>
              <Link
                to="/register"
                className="btn-primary text-sm py-2 px-4 rounded-lg"
              >
                Registrarse
              </Link>
            </>
          )}
        </div>
      </motion.nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mb-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 bg-secondary/50 text-xs text-muted-foreground mb-6"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            Rápido, elegante y gratuito
          </motion.div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-4">
            Acorta tus enlaces,
            <br />
            <span className="text-gradient">amplifica tu alcance</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Crea enlaces cortos y memorables en segundos. Sin desorden, sin
            ruido — solo resultados.
          </p>
        </motion.div>

        {/* Anonymous notice banner */}
        {!user && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="w-full max-w-xl mb-4"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-secondary/40 text-sm text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0 text-primary" />
              <span>
                Los enlaces creados sin cuenta duran{" "}
                <strong className="text-foreground">8 horas</strong>.{" "}
                <Link
                  to="/register"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Crea una cuenta
                </Link>{" "}
                para guardarlos permanentemente.
              </span>
            </div>
          </motion.div>
        )}

        {/* Input form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-xl"
        >
          <div className="glass-card glow-border p-2 flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              placeholder="Pega tu URL larga aquí..."
              className="flex-1 bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground/40 focus:outline-none text-sm"
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="btn-primary text-sm py-3 px-6 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Acortar"
              )}
            </button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-destructive text-xs mt-2 ml-4"
            >
              {error}
            </motion.p>
          )}
        </motion.form>

        {/* URL History */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="w-full max-w-xl mt-8"
        >
          {history.length > 0 && (
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-medium text-muted-foreground">
                {user ? "Tus enlaces" : "Tus enlaces temporales"} (
                {history.length})
              </h2>
              {user && (
                <button
                  onClick={fetchHistory}
                  disabled={historyLoading}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Actualizar"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`}
                  />
                </button>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {history.map((item) => (
              <motion.div
                key={item.shortCode}
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mb-3"
              >
                <ShortenedUrlCard
                  shortUrl={
                    item.kind === "auth"
                      ? { ...item }
                      : {
                          id: 0,
                          originalUrl: item.originalUrl,
                          shortCode: item.shortCode,
                          shortUrl: item.shortUrl,
                          createdAt: item.createdAt,
                          expiresAt: item.expiresAt,
                          linkType: "TEMPORARY" as const,
                          status: "ACTIVE" as const,
                          redirectCount: 0,
                          avgRedirectMs: null,
                          destinationStatus: null,
                          lastCheckedAt: null,
                        }
                  }
                  expiresAt={item.kind === "anon" ? item.expiresAt : undefined}
                  onDelete={item.kind === "auth" ? handleDelete : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {historyLoading && history.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex items-center gap-8 mt-16 text-center"
        >
          <StatsFooter />
        </motion.div>
      </div>
    </div>
  );
};

export default UrlShortener;
