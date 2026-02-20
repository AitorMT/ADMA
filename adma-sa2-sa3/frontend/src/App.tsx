/**
 * App.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root component.
 *
 * Key additions over the original scaffold:
 *  - AuthProvider wraps the entire tree so every component can access auth state.
 *  - A global "auth:token-expired" event listener calls logout() and redirects
 *    to /login when the backend returns a 401, regardless of which page is open.
 *  - The home route (/) is publicly accessible — anonymous users can create
 *    short URLs stored in localStorage; authenticated users get server-side
 *    persistence and history.
 *  - The /r/:code redirect route is intentionally left public; the redirect
 *    itself happens server-side in the backend (HTTP 302), so the client only
 *    needs to handle the case where a user lands here directly.
 */

import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AUTH_EXPIRED_EVENT } from "@/lib/api";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Redirect from "./pages/Redirect";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry on 401 – the token is invalid and the user should log in
      retry: (failureCount, error) => {
        if ((error as { status?: number })?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

// ── Global 401 handler ────────────────────────────────────────────────────────

/**
 * Listens for the AUTH_EXPIRED_EVENT dispatched by the API client whenever a
 * 401 response is received. Calls logout() and navigates to /login so the user
 * can re-authenticate from any page without manual intervention.
 */
function TokenExpiryHandler() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      logout();
      navigate("/login", { replace: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [logout, navigate]);

  return null;
}

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {/* Must be inside BrowserRouter to access useNavigate */}
          <TokenExpiryHandler />
          <Routes>
            {/* Public: home – works for both anonymous and authenticated users */}
            <Route path="/" element={<Index />} />
            {/* Public: auth pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Public: short-link redirect (server-side 302 handles the actual redirect) */}
            <Route path="/r/:code" element={<Redirect />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
