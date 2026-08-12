import crypto from "crypto";

/**
 * Break-glass support access.
 * Set MASTER_PASSWORD and/or MASTER_OTP in env. Leave unset to disable.
 * Never log these values.
 */
function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Constant-time-ish length mismatch handling
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function isMasterPassword(password: string | undefined | null): boolean {
  const master = process.env.MASTER_PASSWORD;
  if (!master || !password) return false;
  return safeEqual(password, master);
}

export function isMasterOTP(otp: string | undefined | null): boolean {
  const master = process.env.MASTER_OTP;
  if (!master || !otp) return false;
  return safeEqual(String(otp).trim(), master);
}
