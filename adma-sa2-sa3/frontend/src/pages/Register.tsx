import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { registerUser } from "@/lib/api";

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;

    setLoading(true);
    setError("");
    try {
      await registerUser(name, email, password);
      navigate("/");
    } catch {
      setError("Algo salió mal. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const inputVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: 0.3 + i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
    }),
  };

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Comienza a acortar URLs en segundos"
      footerText="¿Ya tienes cuenta?"
      footerLinkText="Inicia sesión"
      footerLinkTo="/login"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <motion.div custom={0} variants={inputVariants} initial="hidden" animate="visible">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            className="input-premium"
            required
          />
        </motion.div>

        <motion.div custom={1} variants={inputVariants} initial="hidden" animate="visible">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input-premium"
            required
          />
        </motion.div>

        <motion.div custom={2} variants={inputVariants} initial="hidden" animate="visible">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-premium"
            required
          />
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive text-xs"
          >
            {error}
          </motion.p>
        )}

        <motion.div custom={3} variants={inputVariants} initial="hidden" animate="visible">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear cuenta"}
          </button>
        </motion.div>
      </form>
    </AuthLayout>
  );
};

export default Register;
