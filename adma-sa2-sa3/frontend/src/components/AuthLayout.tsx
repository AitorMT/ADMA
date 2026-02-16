import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
  footerText: string;
  footerLinkText: string;
  footerLinkTo: string;
}

const AuthLayout = ({ children, title, subtitle, footerText, footerLinkText, footerLinkTo }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background dot-pattern relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, hsl(172 66% 50%), transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md mx-4 relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-center mb-8"
        >
          <Link to="/" className="inline-block">
            <h2 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient">otakudojo</span>
              <span className="text-foreground">.es</span>
            </h2>
          </Link>
        </motion.div>

        {/* Card */}
        <div className="glass-card glow-border p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-2xl font-semibold text-foreground mb-1">{title}</h1>
            <p className="text-muted-foreground text-sm mb-8">{subtitle}</p>
          </motion.div>

          {children}
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center mt-6 text-sm text-muted-foreground"
        >
          {footerText}{" "}
          <Link to={footerLinkTo} className="text-primary hover:text-primary/80 transition-colors font-medium">
            {footerLinkText}
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
};

export default AuthLayout;
