const STORAGE_KEY = "drift-detector:anthropic-api-key";

// Stored client-side only (BYOK) — this app has no backend, so the key never
// leaves the browser except in direct calls to api.anthropic.com.
export function getStoredApiKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredApiKey(key: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // localStorage unavailable (private browsing, storage disabled) — key
    // still works for this session via in-memory state in the caller.
  }
}

export function clearStoredApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Dev-only convenience: falls back to VITE_ANTHROPIC_API_KEY (set in .env.local)
// when no key is saved yet, so local development doesn't need a manual paste.
// Gated on import.meta.env.DEV — Vite inlines VITE_-prefixed vars into the
// built JS bundle, so this must stay inert in any production build even if
// the var is present at build time.
export function isUsingDevFallbackKey(): boolean {
  return import.meta.env.DEV && !getStoredApiKey() && Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY);
}

export function getEffectiveApiKey(): string | null {
  const stored = getStoredApiKey();
  if (stored) return stored;
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_ANTHROPIC_API_KEY ?? null;
  }
  return null;
}
