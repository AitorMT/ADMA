/**
 * Redirect.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles short-link resolution from inside the SPA.
 *
 * In production the backend processes the redirect directly (HTTP 302), so
 * this page is only rendered when:
 *  - A user navigates to /r/:code via a ShortenedUrlCard link in the SPA.
 *  - The backend returns 404 (code not found) or 410 (link expired/deleted).
 *
 * Error states are mapped to distinct, informative UI:
 *  - 404 → "Enlace no encontrado"
 *  - 410 → "Enlace expirado"
 *  - other → "Error inesperado"
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Clock, LinkIcon, AlertTriangle, ArrowLeft, Home } from "lucide-react";

const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

type RedirectStatus = "loading" | "not_found" | "expired" | "error";

interface ErrorConfig {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  hint?: string;
}

const ERROR_CONFIGS: Record<Exclude<RedirectStatus, "loading">, ErrorConfig> = {
  not_found: {
    icon: <LinkIcon className="w-6 h-6" />,
    iconBg: "bg-muted text-muted-foreground",
    title: "Enlace no encontrado",
    description: "Esta URL corta no existe en nuestro sistema.",
    hint: "Comprueba que el enlace esté escrito correctamente.",
  },
  expired: {
    icon: <Clock className="w-6 h-6" />,
    iconBg: "bg-amber-500/10 text-amber-500",
    title: "Enlace expirado",
    description: "Este enlace ya no está disponible.",
    hint: "Los enlaces anónimos expiran tras 8 horas. Crea una cuenta para obtener enlaces permanentes.",
  },
  error: {
    icon: <AlertTriangle className="w-6 h-6" />,
    iconBg: "bg-destructive/10 text-destructive",
    title: "Algo salió mal",
    description: "No hemos podido procesar este enlace.",
    hint: "Si el problema persiste, inténtalo de nuevo más tarde.",
  },
};

const Redirect = () => {
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<RedirectStatus>("loading");

  useEffect(() => {
    if (!code) {
      setStatus("not_found");
      return;
    }

    // Case 1: backend already redirected here with ?error=… query param
    // (e.g. the browser clicked a short link that doesn't exist / has expired)
    const errorParam = searchParams.get("error");
    if (errorParam === "expired") {
      setStatus("expired");
      return;
    }
    if (errorParam === "not_found") {
      setStatus("not_found");
      return;
    }

    // Case 2: navigated from inside the SPA (e.g. ShortenedUrlCard)
    // Do a fetch check to detect errors before leaving the SPA.
    const redirectUrl = `${API_BASE_URL}/${code}`;

    fetch(redirectUrl, { method: "GET", redirect: "manual" })
      .then((res) => {
        if (res.type === "opaqueredirect" || res.status === 302 || res.ok) {
          window.location.href = redirectUrl;
        } else if (res.status === 410) {
          setStatus("expired");
        } else if (res.status === 404) {
          setStatus("not_found");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        // Network error — try navigating anyway; backend handles the rest
        window.location.href = redirectUrl;
      });
  }, [code, searchParams]);

  const errorConfig = status !== "loading" ? ERROR_CONFIGS[status] : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, hsl(172 66% 50% / 0.07), transparent 70%)",
        }}
      />

      <AnimatePresence mode="wait">
        {status === "loading" ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5 relative z-10"
          >
            {/* Spinner */}
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-primary/10" />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              />
            </div>

            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-foreground">
                Redirigiendo...
              </p>
              <p className="text-sm text-muted-foreground font-mono">/{code}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full"
          >
            {/* Icon badge */}
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                delay: 0.1,
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1],
              }}
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${errorConfig!.iconBg}`}
            >
              {errorConfig!.icon}
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.35 }}
              className="text-center space-y-2"
            >
              <h1 className="text-xl font-semibold text-foreground">
                {errorConfig!.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {errorConfig!.description}
              </p>
              {errorConfig!.hint && (
                <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto leading-relaxed pt-1">
                  {errorConfig!.hint}
                </p>
              )}
            </motion.div>

            {/* Short code badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="px-3 py-1.5 rounded-lg bg-muted border border-border text-xs font-mono text-muted-foreground"
            >
              /{code}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="flex gap-3"
            >
              <Link
                to="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                Ir al inicio
              </Link>
              {status === "expired" && (
                <Link
                  to="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Crear cuenta
                </Link>
              )}
              {status === "error" && (
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Reintentar
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Redirect;
