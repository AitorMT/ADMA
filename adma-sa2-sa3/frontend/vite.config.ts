import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build:{
    "cssCodeSplit": true,
    "cssMinify": true,
    "rollupOptions": {
      "output": {
        "manualChunks": {
          "react-vendor": ["react", "react-dom"],
          "lucide-react": ["lucide-react"],
          "react-router": ["react-router-dom"],
          "framer-motion": ["framer-motion"],
          "react-hook-form": ["react-hook-form", "@hookform/resolvers"],
          "sonner": ["sonner"],
        }
      }
    }
  }
}));
