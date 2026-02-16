import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { createShortUrl, type ShortUrl } from "@/lib/api";
import ShortenedUrlCard from "@/components/ShortenedUrlCard";

const UrlShortener = () => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShortUrl | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setError("Por favor, ingresa una URL válida");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const shortened = await createShortUrl(url);
      setResult(shortened);
      setUrl("");
    } catch {
      setError("Algo salió mal. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      {/* Background effects */}
      <div className="absolute inset-0 dot-pattern opacity-30" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-[0.04]"
        style={{ background: "radial-gradient(ellipse at center, hsl(14 85% 56%), transparent 70%)" }}
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
          <Link to="/login" className="btn-ghost text-sm py-2 px-4">
            Iniciar sesión
          </Link>
          <Link to="/register" className="btn-primary text-sm py-2 px-4">
            Comenzar
          </Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-20 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-2xl mb-12"
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
            Crea enlaces cortos y memorables en segundos. Sin desorden, sin ruido — solo resultados.
          </p>
        </motion.div>

        {/* Input */}
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
              onChange={(e) => { setUrl(e.target.value); setError(""); }}
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

        {/* Result */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-xl mt-6"
          >
            <ShortenedUrlCard shortUrl={result} />
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex items-center gap-8 mt-16 text-center"
        >
          {[
            { value: "2.4M+", label: "Enlaces creados" },
            { value: "99.9%", label: "Disponibilidad" },
            { value: "< 50ms", label: "Velocidad de redirección" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-xl font-semibold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default UrlShortener;
