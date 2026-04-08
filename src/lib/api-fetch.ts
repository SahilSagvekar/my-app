import { buildAuthenticatedFetchInit } from "@/lib/client-auth";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const authenticatedOptions = buildAuthenticatedFetchInit(options);
  const headers = new Headers(authenticatedOptions.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...authenticatedOptions,
    headers,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}
