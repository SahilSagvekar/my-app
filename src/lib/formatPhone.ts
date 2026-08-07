/**
 * Format a stored phone number for display.
 *
 *   8088958905      → +1 (808) - 895 - 8905
 *   18088958905     → +1 (808) - 895 - 8905
 *   (808) 895-8905  → +1 (808) - 895 - 8905
 *   +44 20 7946 018 → +44 20 7946 018   (left as entered)
 *
 * Display only — never run this on a value bound to an <Input>, or the
 * formatting characters get saved back to the database.
 *
 * Numbers are stored unformatted and inconsistently (some with a country code,
 * some without, some with punctuation), so this normalizes at render time rather
 * than migrating the data.
 */
export function formatPhone(raw?: string | null): string {
  if (raw == null) return "";

  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  const nanp = (d: string) => `+1 (${d.slice(0, 3)}) - ${d.slice(3, 6)} - ${d.slice(6, 10)}`;

  // Bare 10-digit number — assume North American, the app's default market.
  if (digits.length === 10 && !trimmed.startsWith("+")) {
    return nanp(digits);
  }

  // 11 digits led by the NANP country code.
  if (digits.length === 11 && digits.startsWith("1")) {
    return nanp(digits.slice(1));
  }

  // Anything else is international or malformed. Splitting a country code from a
  // subscriber number correctly needs per-country metadata (libphonenumber-js),
  // so preserve exactly what was entered rather than guessing and mangling it.
  return trimmed;
}
