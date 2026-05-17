/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Utilities - Frontend Security Functions
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides XSS protection, secure storage, and token management for frontend.
 * Follows SOLID principles - Single Responsibility for each utility.
 */

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Types (local copy to avoid import issues)
 * ═══════════════════════════════════════════════════════════════════════════
 */

export enum SecureStorageKey {
  ACCESS_TOKEN = "nc_at",
  REFRESH_TOKEN = "nc_rt",
  USER_DATA = "nc_ud",
  CSRF_TOKEN = "nc_csrf",
}

export interface IApiClientSecurityOptions {
  includeAuthToken: boolean;
  includeCsrfToken: boolean;
  timeout: number;
  retryOnUnauthorized: boolean;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * XSS Protection Utilities
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(input: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&",
    "<": "<",
    ">": ">",
    '"': '"',
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Strip HTML tags
 */
export function stripHtml(input: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = input;
  return tmp.textContent || tmp.innerText || "";
}

/**
 * Validate and sanitize user input
 */
export function sanitizeUserInput(input: string): string {
  // First strip all HTML
  let sanitized = stripHtml(input);
  // Then escape any remaining special characters
  sanitized = escapeHtml(sanitized);
  return sanitized;
}

/**
 * Check if string contains potential XSS
 */
export function containsXss(input: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /<svg.*onload/i,
    /<img.*onerror/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Secure Storage Utilities
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Securely store token (using memory + sessionStorage)
 */
export function setSecureToken(key: SecureStorageKey, value: string): void {
  try {
    // Store in sessionStorage (cleared on tab close)
    sessionStorage.setItem(key, value);
  } catch (e) {
    console.error("Failed to store token:", e);
  }
}

/**
 * Get secure token from storage
 */
export function getSecureToken(key: SecureStorageKey): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (e) {
    console.error("Failed to retrieve token:", e);
    return null;
  }
}

/**
 * Remove secure token
 */
export function removeSecureToken(key: SecureStorageKey): void {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {
    console.error("Failed to remove token:", e);
  }
}

/**
 * Clear all secure tokens
 */
export function clearAllSecureTokens(): void {
  const keys = Object.values(SecureStorageKey);
  keys.forEach((key) => removeSecureToken(key));
}

/**
 * Securely store sensitive data (with encoding)
 */
export function setSecureData(key: string, value: unknown): void {
  try {
    const encoded = btoa(JSON.stringify(value));
    sessionStorage.setItem(key, encoded);
  } catch (e) {
    console.error("Failed to store secure data:", e);
  }
}

/**
 * Get and decode secure data
 */
export function getSecureData<T = unknown>(key: string): T | null {
  try {
    const encoded = sessionStorage.getItem(key);
    if (!encoded) return null;
    return JSON.parse(atob(encoded)) as T;
  } catch (e) {
    console.error("Failed to retrieve secure data:", e);
    return null;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Token Management
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Extract JWT payload
 */
export function getJwtPayload<T = Record<string, unknown>>(
  token: string,
): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Handle base64url encoding
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(base64);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = getJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) return true;

  return Date.now() >= payload.exp * 1000;
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = getJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) return null;

  return new Date(payload.exp * 1000);
}

/**
 * Check if token expires soon (within minutes)
 */
export function isTokenExpiringSoon(
  token: string,
  minutes: number = 5,
): boolean {
  const expiration = getTokenExpiration(token);
  if (!expiration) return true;

  const now = Date.now();
  const threshold = minutes * 60 * 1000;

  return expiration.getTime() - now < threshold;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API Client Security
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
  const name = "XSRF-TOKEN=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(";");

  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return null;
}

/**
 * Create secure fetch options
 */
export function createSecureFetchOptions(
  options: IApiClientSecurityOptions & RequestInit = {
    includeAuthToken: true,
    includeCsrfToken: true,
    timeout: 30000,
    retryOnUnauthorized: true,
  },
): RequestInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add auth token
  if (options.includeAuthToken) {
    const token = getSecureToken(SecureStorageKey.ACCESS_TOKEN);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  // Add CSRF token for state-changing requests
  if (
    options.includeCsrfToken &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(options.method || "")
  ) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  return {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: "include",
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Data Masking Utilities
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;

  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `**@${domain}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  if (!phone) return phone;

  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "*".repeat(digits.length);
  }

  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * Mask credit card
 */
export function maskCreditCard(card: string): string {
  if (!card) return card;

  const digits = card.replace(/\D/g, "");
  if (digits.length < 4) {
    return "*".repeat(digits.length);
  }

  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Input Validation
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 8) {
    feedback.push("Password must be at least 8 characters");
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    feedback.push("Password must contain lowercase letters");
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    feedback.push("Password must contain uppercase letters");
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    feedback.push("Password must contain numbers");
  } else {
    score++;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    feedback.push("Password must contain special characters");
  } else {
    score++;
  }

  return {
    valid: feedback.length === 0,
    score,
    feedback,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Headers Configuration
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Apply security headers to fetch requests
 */
export function applySecurityHeaders(headers: Headers): void {
  // Remove potentially dangerous headers
  headers.delete("X-Requested-With");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
}
