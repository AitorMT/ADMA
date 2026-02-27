/**
 * localUrlStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side storage for anonymous short URLs.
 *
 * Anonymous users (not logged in) can create short URLs that are persisted in
 * localStorage with an 8-hour TTL — matching the backend's server-side expiry.
 * Once the user registers or logs in, these are synced to the backend via
 * POST /api/urls/sync and removed from storage.
 *
 * Schema per entry:
 * {
 *   originalUrl : string   – the original (long) URL
 *   shortCode   : string   – the short code returned by the backend
 *   shortUrl    : string   – fully-qualified short URL
 *   createdAt   : string   – ISO 8601 timestamp
 *   expiresAt   : string   – ISO 8601 timestamp (createdAt + 8 h)
 * }
 */

export interface AnonShortUrl {
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  createdAt: string;
  expiresAt: string;
}

const STORAGE_KEY = "anon_short_urls";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — must match backend ANON_TTL_HOURS

// ── Read ──────────────────────────────────────────────────────────────────────

/** Returns all stored entries (including expired ones). */
function readAll(): AnonShortUrl[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnonShortUrl[];
  } catch {
    return [];
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────

function writeAll(entries: AnonShortUrl[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage quota exceeded – silently skip
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all non-expired anonymous short URLs, ordered newest-first.
 * Expired entries are pruned as a side-effect of this call.
 */
export function getValidAnonUrls(): AnonShortUrl[] {
  const now = Date.now();
  const all = readAll();
  const valid = all.filter((e) => new Date(e.expiresAt).getTime() > now);

  // Prune expired entries if any were removed
  if (valid.length < all.length) {
    writeAll(valid);
  }

  return valid.slice().reverse(); // newest-first
}

/**
 * Persists a new anonymous short URL returned by the backend.
 * The TTL starts from now.
 */
export function saveAnonUrl(
  originalUrl: string,
  shortCode: string,
  shortUrl: string,
): AnonShortUrl {
  const now = new Date();
  const entry: AnonShortUrl = {
    originalUrl,
    shortCode,
    shortUrl,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + TTL_MS).toISOString(),
  };

  const existing = readAll();
  writeAll([...existing, entry]);
  return entry;
}

/**
 * Removes all anonymous short URLs from localStorage.
 * Called after a successful sync to the backend.
 */
export function clearAnonUrls(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Removes a single anonymous URL by shortCode.
 */
export function removeAnonUrl(shortCode: string): void {
  const updated = readAll().filter((e) => e.shortCode !== shortCode);
  writeAll(updated);
}

/**
 * Returns the count of valid (non-expired) anonymous URLs.
 */
export function countValidAnonUrls(): number {
  return getValidAnonUrls().length;
}
