const STORAGE_KEY = "cubicle_device_token";

/** Notified whenever the stored token changes, so the socket connection and
 * any "you're logged out" UI can react without a full page reload. */
type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  window.localStorage.setItem(STORAGE_KEY, token);
  listeners.forEach((fn) => fn(token));
}

export function clearAuthToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((fn) => fn(null));
}

export function onAuthTokenChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
