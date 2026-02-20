/**
 * AuthContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for authentication state across the app.
 *
 * Responsibilities:
 *  - Store and expose the authenticated user + JWT token
 *  - Persist the token in localStorage (survives page refresh)
 *  - Provide login / logout helpers consumed by pages and the API client
 *  - Expose a loading flag so pages can gate rendering until the initial
 *    token check is complete
 *
 * The token is never stored in a cookie to avoid CSRF surface; it is sent
 * explicitly via the Authorization header on every protected request.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  email: string;
  name: string;
}

interface AuthContextValue {
  /** Authenticated user, or null when logged out. */
  user: AuthUser | null;
  /** Raw JWT string, or null when logged out. */
  token: string | null;
  /** True while the initial localStorage token hydration is in progress. */
  isLoading: boolean;
  /** Call after a successful login/register API response. */
  setAuth: (token: string, user: AuthUser) => void;
  /** Clears all auth state and removes the token from storage. */
  logout: () => void;
}

// ── localStorage key ─────────────────────────────────────────────────────────

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * On mount, rehydrate auth state from localStorage.
   * This prevents a flash of "logged out" UI on page refresh.
   */
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthUser);
      } catch {
        // Corrupt storage — clear it and start fresh
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  /** Persist auth state after a successful login or register. */
  const setAuth = useCallback((newToken: string, newUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  /** Clear all auth state (called on logout or on 401 responses). */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Convenience hook – throws if used outside of {@link AuthProvider}.
 *
 * @example
 *   const { user, token, logout } = useAuth();
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
