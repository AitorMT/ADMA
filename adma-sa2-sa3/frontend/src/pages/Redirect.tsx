import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import { resolveShortUrl } from "@/lib/api";

const Redirect = () => {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      return;
    }

    resolveShortUrl(code)
      .then((url) => {
        // TODO: In production, redirect happens server-side
        // This is a client-side placeholder
        console.log("Redirecting to:", url);
        // window.location.href = url;
      })
      .catch(() => setStatus("error"));
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-[0.06]"
        style={{ background: "radial-gradient(circle, hsl(172 66% 50%), transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center relative z-10"
      >
        {status === "loading" ? (
          <>
            {/* Animated loader */}
            <div className="relative w-12 h-12 mx-auto mb-6">
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary/20"
              />
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
            </div>

            <h2 className="text-lg font-semibold text-foreground mb-1">
              Redirigiendo...
            </h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-primary">otakudojo.es/{code}</span>
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
              <span className="text-destructive text-xl">!</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Enlace no encontrado
            </h2>
            <p className="text-sm text-muted-foreground">
              Esta URL corta no existe o ha expirado.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Redirect;
