// app/api/logins/2fa/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { decrypt } from "@/lib/encryption";
import * as crypto from "crypto";

function getTokenFromCookies(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;

    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function verifyToken(token: string): { userId: number; role: string } | null {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: number;
            role: string;
        };
        return decoded;
    } catch (error) {
        console.error("Token verification failed:", error);
        return null;
    }
}

// Verify TOTP code manually (RFC 6238)
function verifyTotpCode(secret: string, code: string): boolean {
    const period = 30; // 30 second time step
    const digits = 6;
    const currentTime = Math.floor(Date.now() / 1000);

    // Check current time step and one before/after for clock drift tolerance
    for (let i = -1; i <= 1; i++) {
        const timeStep = Math.floor((currentTime + i * period) / period);
        const generatedCode = generateTotp(secret, timeStep, digits);
        if (generatedCode === code) {
            return true;
        }
    }
    return false;
}

function generateTotp(secret: string, timeStep: number, digits: number): string {
    // Convert time step to buffer (big-endian 8 bytes)
    const timeBuffer = Buffer.alloc(8);
    let tempTime = timeStep;
    for (let i = 7; i >= 0; i--) {
        timeBuffer[i] = tempTime & 0xff;
        tempTime = Math.floor(tempTime / 256);
    }

    // Decode base32 secret
    const secretBuffer = base32Decode(secret);

    // HMAC-SHA1
    const hmac = crypto.createHmac("sha1", secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, "0");
}

function base32Decode(encoded: string): Buffer {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "");

    let bits = "";
    for (const char of cleanedInput) {
        const index = alphabet.indexOf(char);
        if (index === -1) continue;
        bits += index.toString(2).padStart(5, "0");
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }

    return Buffer.from(bytes);
}

// POST - Verify TOTP code (used both for enabling 2FA and for session verification)
export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);

        if (!token) {
            return NextResponse.json(
                { success: false, error: "Unauthorized - No token provided" },
                { status: 401 }
            );
        }

        const decoded = verifyToken(token);

        if (!decoded) {
            return NextResponse.json(
                { success: false, error: "Unauthorized - Invalid token" },
                { status: 401 }
            );
        }

        const { userId } = decoded;

        const body = await req.json();
        const { code, enableAfterVerify = false } = body;

        if (!code || typeof code !== "string") {
            return NextResponse.json(
                { success: false, error: "Verification code is required" },
                { status: 400 }
            );
        }

        // Get user's 2FA settings
        const twoFactorAuth = await prisma.userTwoFactorAuth.findUnique({
            where: { userId },
        });

        if (!twoFactorAuth) {
            return NextResponse.json(
                { success: false, error: "2FA is not set up" },
                { status: 400 }
            );
        }

        // Decrypt the secret
        const secret = decrypt(twoFactorAuth.totpSecret);

        // Verify the TOTP code
        const cleanCode = code.replace(/\s/g, ""); // Remove any spaces
        const isValid = verifyTotpCode(secret, cleanCode);

        if (!isValid) {
            // Check if it's a backup code
            let backupCodeUsed = false;
            const remainingBackupCodes: string[] = [];

            for (const encryptedCode of twoFactorAuth.backupCodes) {
                const decryptedCode = decrypt(encryptedCode);
                if (decryptedCode.toUpperCase() === cleanCode.toUpperCase()) {
                    backupCodeUsed = true;
                } else {
                    remainingBackupCodes.push(encryptedCode);
                }
            }

            if (!backupCodeUsed) {
                return NextResponse.json(
                    { success: false, error: "Invalid verification code" },
                    { status: 401 }
                );
            }

            // Remove used backup code
            await prisma.userTwoFactorAuth.update({
                where: { userId },
                data: {
                    backupCodes: remainingBackupCodes,
                    lastVerifiedAt: new Date(),
                },
            });

            return NextResponse.json({
                success: true,
                verified: true,
                backupCodeUsed: true,
                remainingBackupCodes: remainingBackupCodes.length,
            });
        }

        // If enableAfterVerify is true, enable 2FA after successful verification
        if (enableAfterVerify && !twoFactorAuth.isEnabled) {
            await prisma.userTwoFactorAuth.update({
                where: { userId },
                data: {
                    isEnabled: true,
                    lastVerifiedAt: new Date(),
                },
            });

            return NextResponse.json({
                success: true,
                verified: true,
                enabled: true,
                message: "2FA has been enabled successfully",
            });
        }

        // Update last verified timestamp
        await prisma.userTwoFactorAuth.update({
            where: { userId },
            data: { lastVerifiedAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            verified: true,
        });
    } catch (error) {
        console.error("Failed to verify 2FA:", error);
        return NextResponse.json(
            { success: false, error: "Failed to verify 2FA" },
            { status: 500 }
        );
    }
}
