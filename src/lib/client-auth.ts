const AUTH_TOKEN_STORAGE_KEY = "token";
const AUTH_COOKIE_NAME = "authToken";
let inMemoryAuthToken: string | null = null;

function getStorage(kind: "sessionStorage" | "localStorage"): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window[kind];
  } catch {
    return null;
  }
}

export function getStoredAuthToken() {
  return (
    inMemoryAuthToken ??
    getStorage("sessionStorage")?.getItem(AUTH_TOKEN_STORAGE_KEY) ??
    getStorage("localStorage")?.getItem(AUTH_TOKEN_STORAGE_KEY) ??
    getCookieAuthToken() ??
    null
  );
}

export function getCookieAuthToken() {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(/(?:^|;\s*)authToken=([^;]+)/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function persistAuthToken(token: string, rememberMe = false) {
  clearStoredAuthToken();
  inMemoryAuthToken = token;

  const storage = rememberMe ? getStorage("localStorage") : getStorage("sessionStorage");
  storage?.setItem(AUTH_TOKEN_STORAGE_KEY, token);

  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
  }
}

export function clearStoredAuthToken() {
  inMemoryAuthToken = null;
  getStorage("sessionStorage")?.removeItem(AUTH_TOKEN_STORAGE_KEY);
  getStorage("localStorage")?.removeItem(AUTH_TOKEN_STORAGE_KEY);

  if (typeof document !== "undefined") {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; samesite=lax`;
  }
}

export function buildAuthenticatedFetchInit(init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getStoredAuthToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return {
    ...init,
    credentials: init.credentials ?? "include",
    headers,
  };
}
