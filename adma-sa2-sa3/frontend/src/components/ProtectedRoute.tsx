/**
 * ProtectedRoute
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps any route that requires authentication.
 * Redirects unauthenticated users to /login, preserving the intended destination
 * in router state so they can be sent back after a successful login.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Don't redirect while the initial localStorage hydration is in progress
  if (isLoading) {
    return null;
  }

  if (!user) {
    // Save the current path so Login can redirect back after success
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
