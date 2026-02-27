import { useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, Link } from "react-router-dom";
import { FileQuestion, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404: ruta no encontrada:", location.pathname);
  }, [location.pathname]);

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

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground"
        >
          <FileQuestion className="w-7 h-7" />
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="space-y-2"
        >
          <p className="text-xs font-mono text-muted-foreground/60 tracking-widest uppercase">
            Error 404
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            Página no encontrada
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La ruta{" "}
            <span className="font-mono text-foreground/70 bg-muted px-1.5 py-0.5 rounded text-xs">
              {location.pathname}
            </span>{" "}
            no existe.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Home className="w-4 h-4" />
            Volver al inicio
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;
