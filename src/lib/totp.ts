// Shared TOTP helpers for Google Authenticator (drive/file deletes, social logins, etc.)
import { authenticator } from "otplib";
import { getDbHttp } from "@/lib/db";
import { userTwoFactorAuth } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/encryption";

authenticator.options = {
  window: 2, // ±60s clock drift
};

export type TotpStatus = {
  has2FA: boolean;
  isEnabled: boolean;
  remainingBackupCodes: number;
};

export async function getUserTotpStatus(userId: number): Promise<TotpStatus> {
  const db = getDbHttp();
  const [row] = await db
    .select({
      isEnabled: userTwoFactorAuth.isEnabled,
      backupCodes: userTwoFactorAuth.backupCodes,
    })
    .from(userTwoFactorAuth)
    .where(eq(userTwoFactorAuth.userId, userId))
    .limit(1);

  if (!row) {
    return { has2FA: false, isEnabled: false, remainingBackupCodes: 0 };
  }

  return {
    has2FA: true,
    isEnabled: row.isEnabled,
    remainingBackupCodes: (row.backupCodes ?? []).length,
  };
}

export type VerifyTotpResult =
  | { ok: true; backupCodeUsed?: boolean; remainingBackupCodes?: number }
  | { ok: false; error: string; code: "NOT_SETUP" | "NOT_ENABLED" | "INVALID" | "MISSING" };

/**
 * Verify a TOTP or backup code for a user.
 * When consumeBackupCode is true (default), used backup codes are removed.
 */
export async function verifyUserTotp(
  userId: number,
  code: string | undefined | null,
  options: { requireEnabled?: boolean; consumeBackupCode?: boolean } = {}
): Promise<VerifyTotpResult> {
  const { requireEnabled = true, consumeBackupCode = true } = options;

  if (!code || typeof code !== "string") {
    return { ok: false, error: "Authenticator code is required", code: "MISSING" };
  }

  const cleanCode = code.replace(/\s/g, "");
  if (!cleanCode) {
    return { ok: false, error: "Authenticator code is required", code: "MISSING" };
  }

  const db = getDbHttp();
  const [twoFactorAuth] = await db
    .select()
    .from(userTwoFactorAuth)
    .where(eq(userTwoFactorAuth.userId, userId))
    .limit(1);

  if (!twoFactorAuth) {
    return {
      ok: false,
      error: "Authenticator app is not set up",
      code: "NOT_SETUP",
    };
  }

  if (requireEnabled && !twoFactorAuth.isEnabled) {
    return {
      ok: false,
      error: "Authenticator app is not enabled",
      code: "NOT_ENABLED",
    };
  }

  const secret = decrypt(twoFactorAuth.totpSecret);
  const isValid = authenticator.verify({ token: cleanCode, secret });

  if (isValid) {
    await db
      .update(userTwoFactorAuth)
      .set({
        lastVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userTwoFactorAuth.userId, userId));

    return { ok: true };
  }

  // Fallback: backup codes
  let backupCodeUsed = false;
  const remainingBackupCodes: string[] = [];

  for (const encryptedCode of twoFactorAuth.backupCodes ?? []) {
    const decryptedCode = decrypt(encryptedCode);
    if (decryptedCode.toUpperCase() === cleanCode.toUpperCase()) {
      backupCodeUsed = true;
    } else {
      remainingBackupCodes.push(encryptedCode);
    }
  }

  if (!backupCodeUsed) {
    return { ok: false, error: "Invalid authenticator code", code: "INVALID" };
  }

  if (consumeBackupCode) {
    await db
      .update(userTwoFactorAuth)
      .set({
        backupCodes: remainingBackupCodes,
        lastVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userTwoFactorAuth.userId, userId));
  }

  return {
    ok: true,
    backupCodeUsed: true,
    remainingBackupCodes: remainingBackupCodes.length,
  };
}

/** Roles that must present a TOTP code to delete drive/file items. Clients are exempt. */
export function roleRequiresDeleteTotp(role: string | null | undefined): boolean {
  if (!role) return true;
  return role.toLowerCase() !== "client";
}

/** Clear a user's TOTP enrollment (after successful verification or admin reset). */
export async function clearUserTotp(userId: number): Promise<void> {
  const db = getDbHttp();
  await db.delete(userTwoFactorAuth).where(eq(userTwoFactorAuth.userId, userId));
}

export { authenticator, encrypt, decrypt };
