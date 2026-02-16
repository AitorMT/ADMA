// ============================================
// Mock API Layer — Backend Integration Stubs
// ============================================
// All functions below are placeholders for real backend logic.
// Replace with actual API calls when connecting to a backend service.

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface ShortUrl {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  createdAt: string;
  clicks: number;
}

// Simulated delay to mimic network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate a random short code
const generateCode = () => Math.random().toString(36).substring(2, 8);

/**
 * TODO: Connect to real authentication backend
 * Authenticates a user with email and password.
 */
export async function loginUser(email: string, _password: string): Promise<User> {
  await delay(1200);
  // Simulate successful login
  return {
    id: "usr_" + generateCode(),
    email,
    name: email.split("@")[0],
  };
}

/**
 * TODO: Connect to real authentication backend
 * Registers a new user account.
 */
export async function registerUser(name: string, email: string, _password: string): Promise<User> {
  await delay(1500);
  return {
    id: "usr_" + generateCode(),
    email,
    name,
  };
}

/**
 * TODO: Connect to real URL shortening backend
 * Creates a short URL from a long URL.
 */
export async function createShortUrl(originalUrl: string): Promise<ShortUrl> {
  await delay(1000);
  const shortCode = generateCode();
  return {
    id: "url_" + generateCode(),
    originalUrl,
    shortCode,
    shortUrl: `otakudojo.es/${shortCode}`,
    createdAt: new Date().toISOString(),
    clicks: 0,
  };
}

/**
 * TODO: Connect to real backend
 * Resolves a short code to its original URL.
 */
export async function resolveShortUrl(shortCode: string): Promise<string> {
  await delay(800);
  // Simulate resolving — in production, this redirects server-side
  console.log(`Resolving short code: ${shortCode}`);
  return "https://example.com/very-long-original-url-that-was-shortened";
}

/**
 * TODO: Connect to real backend
 * Logs out the current user.
 */
export async function logoutUser(): Promise<void> {
  await delay(300);
}
