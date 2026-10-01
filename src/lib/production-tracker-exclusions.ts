// Clients hidden from the admin Production Tracker (internal/test/non-tracked
// accounts). Matched by normalized company name or contact name, so it keeps
// working if the same client is recreated with a new id.

const HIDDEN_CLIENT_NAMES = new Set([
  "tdbs",
  "the dating blind show",
  "william coleman",
  "e8 test",
  "test e8",
  "e8 client",
]);

const normalize = (s?: string | null) =>
  (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function isHiddenFromProductionTracker(c: {
  name?: string | null;
  companyName?: string | null;
}): boolean {
  return HIDDEN_CLIENT_NAMES.has(normalize(c.companyName)) || HIDDEN_CLIENT_NAMES.has(normalize(c.name));
}
