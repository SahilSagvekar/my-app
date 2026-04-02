import { buildAuthenticatedFetchInit } from "@/lib/client-auth";

export async function api(path: string, options: RequestInit = {}) {
  const authenticatedOptions = buildAuthenticatedFetchInit(options);
  const headers = new Headers(authenticatedOptions.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...authenticatedOptions,
    headers,
  });

  return res.json();
}
