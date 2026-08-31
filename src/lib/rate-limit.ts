/**
 * Minimal fixed-window rate limiter.
 *
 * Deliberately in-process: this app runs as a single small deployment and the
 * goal is to blunt credential stuffing against /api/auth, which previously had
 * no limit of any kind. On a multi-instance deployment each instance keeps its
 * own window, which lifts the effective ceiling but still bounds it. Swap the
 * Map for Redis/Upstash if the app is ever scaled out.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Opportunistic sweep so the Map cannot grow without bound.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const allowed = existing.count <= max;
  return {
    allowed,
    remaining: Math.max(0, max - existing.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Clears a key's window, e.g. after a successful sign-in. */
export function resetRateLimit(key: string) {
  windows.delete(key);
}

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
