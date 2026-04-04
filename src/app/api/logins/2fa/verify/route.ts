export const dynamic = 'force-dynamic';
// app/api/logins/2fa/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { decrypt } from "@/lib/encryption";
import { authenticator } from "otplib";

// Configure otplib with wider time window for clock drift tolerance
// Window of 2 means ±2 time steps = ±60 seconds tolerance
authenticator.options = {
    window: 2,
};

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

        // Clean the code (remove spaces)
        const cleanCode = code.replace(/\s/g, "");

        // Verify the TOTP code using otplib
        const isValid = authenticator.verify({ token: cleanCode, secret });

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