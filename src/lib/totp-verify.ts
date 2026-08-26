// src/lib/totp-verify.ts
//
// Shared server-side TOTP (Google Authenticator) verification, extracted
// from the logic already used by /api/logins/2fa/verify. Used to gate
// destructive actions (e.g. admin deletes in Files & Drive) behind a code,
// without duplicating the decrypt/otplib logic per route.

import { getDbHttp } from "@/lib/db";
import { userTwoFactorAuth } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { authenticator } from "otplib";

authenticator.options = {
  window: 2, // ±60s clock drift tolerance, same as /api/logins/2fa/verify
};

export type TotpCheckResult =
  | { ok: true }
  | { ok: false; reason: "not_set_up" | "missing_code" | "invalid_code" };

/**
 * Verifies a TOTP (or backup) code for a user. Does NOT enable 2FA and does
 * NOT consume the code from state beyond removing a used backup code — call
 * this right before the protected action, per request, every time. A stale
 * "verified 5 minutes ago" flag is not good enough for a delete gate.
 */
export async function verifyTotpCode(userId: number, code: string | null | undefined): Promise<TotpCheckResult> {
  if (!code || typeof code !== "string" || !code.trim()) {
    return { ok: false, reason: "missing_code" };
  }

  const db = getDbHttp();
  const [twoFactorAuth] = await db.select().from(userTwoFactorAuth)
    .where(eq(userTwoFactorAuth.userId, userId)).limit(1);

  if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
    return { ok: false, reason: "not_set_up" };
  }

  const secret = decrypt(twoFactorAuth.totpSecret);
  const cleanCode = code.replace(/\s/g, "");

  const isValid = authenticator.verify({ token: cleanCode, secret });
  if (isValid) {
    await db.update(userTwoFactorAuth).set({
      lastVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(userTwoFactorAuth.userId, userId));
    return { ok: true };
  }

  // Fall back to a backup code, same as /api/logins/2fa/verify — and
  // consume it so it can't be reused.
  const remainingBackupCodes: string[] = [];
  let backupCodeUsed = false;
  for (const encryptedCode of (twoFactorAuth.backupCodes ?? [])) {
    const decryptedCode = decrypt(encryptedCode);
    if (!backupCodeUsed && decryptedCode.toUpperCase() === cleanCode.toUpperCase()) {
      backupCodeUsed = true;
    } else {
      remainingBackupCodes.push(encryptedCode);
    }
  }

  if (!backupCodeUsed) {
    return { ok: false, reason: "invalid_code" };
  }

  await db.update(userTwoFactorAuth).set({
    backupCodes: remainingBackupCodes,
    lastVerifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).where(eq(userTwoFactorAuth.userId, userId));

  return { ok: true };
}