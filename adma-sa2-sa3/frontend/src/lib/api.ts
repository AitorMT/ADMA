/**
 * API Client — URL Shortener Backend
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised layer for all HTTP communication with the Spring Boot backend.
 *
 * Design decisions:
 *  - The base URL is read from the Vite env variable VITE_API_BASE_URL, which
 *    is injected at build time. This means the same image works locally,
 *    in Docker Compose, and on AWS ECS Fargate — only the env var changes.
 *  - JWT is attached to every request via Authorization: Bearer <token>.
 *    The token itself is managed by AuthContext; callers pass it in.
 *  - A 401 response triggers an event that AuthContext listens to, so any
 *    expired token causes a clean logout regardless of which page is active.
 *  - The ApiError class carries the HTTP status, letting call-sites decide
 *    how to present the error (e.g. 409 Conflict → "email already taken").
 */

// ── Environment ───────────────────────────────────────────────────────────────

/**
 * Backend base URL.
 * Set VITE_API_BASE_URL in:
 *  - .env.local          → local development  (e.g. http://localhost:8080)
 *  - .env.production     → production default (can be overridden by Docker ARG)
 *  - Dockerfile ARG      → injected at image build time for containerised runs
 *  - ECS task definition → VITE_API_BASE_URL passed as a build-time ARG
 *
 * Falls back to empty string so that relative requests work when the frontend
 * is served from the same origin as the API (e.g. behind a reverse proxy).
 */
const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

// ── Event bus for global 401 handling ─────────────────────────────────────────

/**
 * Fired whenever the API receives a 401 Unauthorized response.
 * AuthProvider listens for this event and calls logout() automatically,
 * ensuring the user is redirected to /login from any page.
 */
export const AUTH_EXPIRED_EVENT = "auth:token-expired";

function dispatchAuthExpired(): void {
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

// ── Error type ────────────────────────────────────────────────────────────────

/**
 * Structured error thrown by all API functions.
 * Callers can inspect {@link status} to show context-sensitive messages.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Raw server error body, if any. */
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Response types (mirror backend DTOs) ─────────────────────────────────────

/** Mirrors AuthResponse from the Spring Boot backend. */
export interface AuthResponse {
  token: string;
  name: string;
  email: string;
}

/** Mirrors ShortUrlResponse from the Spring Boot backend. */
export interface ShortUrl {
  id: number;
  originalUrl: string;
  shortCode: string;
  /** Fully-qualified short URL, e.g. https://short.ly/aB3xYz */
  shortUrl: string;
  createdAt: string;
  /** ISO 8601 expiry timestamp. Null for permanent (registered) links. */
  expiresAt: string | null;
  /** TEMPORARY (anonymous) or PERMANENT (registered) */
  linkType: "TEMPORARY" | "PERMANENT";
  /** ACTIVE, EXPIRED, or DELETED */
  status: "ACTIVE" | "EXPIRED" | "DELETED";
  /** Total redirect count */
  redirectCount: number;
  /** Running average redirect latency in ms. Null until first redirect. */
  avgRedirectMs: number | null;
  /** Last HTTP status of the destination URL. Null until first check. */
  destinationStatus: number | null;
  /** ISO 8601 timestamp of last destination availability check. */
  lastCheckedAt: string | null;
}

// ── Internal fetch wrapper ────────────────────────────────────────────────────

interface RequestOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
}

/**
 * Core HTTP utility. Attaches the Bearer token when provided,
 * parses JSON responses, and converts error responses to {@link ApiError}.
 */
async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", token, body } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Attach JWT as a Bearer token on every authenticated call
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Token expired or invalid → trigger global logout
  if (response.status === 401) {
    dispatchAuthExpired();
    throw new ApiError(401, "Session expired. Please log in again.");
  }

  // Parse body (present on most responses; empty on 302/204)
  let data: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    // Backend returns { status, error, message, fieldErrors? }
    const serverMessage =
      (data as { message?: string } | null)?.message ?? response.statusText;
    throw new ApiError(response.status, serverMessage, data);
  }

  return data as T;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Registers a new user. The backend immediately returns a JWT so the user
 * is signed in without a separate login step.
 */
export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
}

/**
 * POST /auth/login
 * Authenticates an existing user and returns a JWT.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

// ── URL shortener endpoints ───────────────────────────────────────────────────

/**
 * POST /api/urls  (authenticated)
 * Creates a new short URL owned by the authenticated user.
 *
 * @param originalUrl  The long URL to shorten (must start with http/https/ftp)
 * @param token        Valid JWT from AuthContext
 */
export async function createShortUrl(
  originalUrl: string,
  token: string,
): Promise<ShortUrl> {
  return request<ShortUrl>("/api/urls", {
    method: "POST",
    token,
    body: { originalUrl },
  });
}

/**
 * GET /api/urls  (authenticated)
 * Returns all short URLs owned by the authenticated user, newest first.
 *
 * @param token  Valid JWT from AuthContext
 */
export async function listShortUrls(token: string): Promise<ShortUrl[]> {
  return request<ShortUrl[]>("/api/urls", { token });
}

/**
 * POST /api/urls/public  (anonymous – no token required)
 * Creates a short URL without authentication. The backend stores it with
 * userId = null. The client should persist the response in localStorage
 * and sync it to the backend on login/register.
 *
 * @param originalUrl  The long URL to shorten
 */
export async function createAnonShortUrl(
  originalUrl: string,
): Promise<ShortUrl> {
  return request<ShortUrl>("/api/urls/public", {
    method: "POST",
    body: { originalUrl },
  });
}

/**
 * POST /api/urls/sync  (authenticated)
 * Bulk-syncs a list of original URLs (from anonymous localStorage) to the
 * authenticated user's account. Duplicates are silently skipped by the backend.
 *
 * @param originalUrls  Array of original (long) URLs to claim
 * @param token         Valid JWT from AuthContext
 * @returns             The user's full updated URL list
 */
export async function syncAnonUrls(
  originalUrls: string[],
  token: string,
): Promise<ShortUrl[]> {
  return request<ShortUrl[]>("/api/urls/sync", {
    method: "POST",
    token,
    body: { urls: originalUrls },
  });
}

/**
 * DELETE /api/urls/:id  (authenticated)
 * Soft-deletes a short URL owned by the authenticated user.
 *
 * @param id    ID of the short URL to delete
 * @param token Valid JWT from AuthContext
 */
export async function deleteShortUrl(id: number, token: string): Promise<void> {
  return request<void>(`/api/urls/${id}`, {
    method: "DELETE",
    token,
  });
}

// ── Public stats ──────────────────────────────────────────────────────────────

export interface PlatformStats {
  /** Total short URLs ever created on the platform. */
  totalLinks: number;
  /** Sum of all redirect events across every short URL. */
  totalRedirects: number;
  /**
   * Global mean redirect latency in ms.
   * null when no redirects have been recorded yet.
   */
  avgLatencyMs: number | null;
}

/**
 * GET /api/stats  (public — no auth required)
 * Returns live aggregate platform statistics for the landing page footer.
 */
export async function getStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/api/stats", { method: "GET" });
}
