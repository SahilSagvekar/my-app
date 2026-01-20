// app/api/logins/2fa/setup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { encrypt } from "@/lib/encryption";
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

// Generate a random secret for TOTP
function generateSecret(): string {
    // Generate 20 random bytes and encode as base32
    const buffer = crypto.randomBytes(20);
    const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let secret = "";
    for (let i = 0; i < buffer.length; i++) {
        secret += base32Chars[buffer[i] % 32];
    }
    return secret;
}

// Generate otpauth URL for QR code
function generateOtpauthUrl(
    account: string,
    issuer: string,
    secret: string
): string {
    const encodedAccount = encodeURIComponent(account);
    const encodedIssuer = encodeURIComponent(issuer);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// POST - Generate TOTP secret and QR code for setup
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

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true },
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        // Check if user already has 2FA enabled
        const existing2FA = await prisma.userTwoFactorAuth.findUnique({
            where: { userId },
        });

        if (existing2FA?.isEnabled) {
            return NextResponse.json(
                { success: false, error: "2FA is already enabled" },
                { status: 400 }
            );
        }

        // Generate a new TOTP secret
        const secret = generateSecret();

        // Create the otpauth URL for the QR code
        const appName = "E8 Productions";
        const accountName = user.email || user.name || `User ${userId}`;
        const otpauthUrl = generateOtpauthUrl(accountName, appName, secret);

        // Generate QR code as data URL
        const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

        // Generate backup codes (8 codes, 8 characters each)
        const backupCodes: string[] = [];
        for (let i = 0; i < 8; i++) {
            const code = crypto.randomBytes(4).toString("hex").toUpperCase();
            backupCodes.push(code);
        }

        // Encrypt the secret before storing
        const encryptedSecret = encrypt(secret);

        // Store or update the 2FA setup (but not enabled yet)
        await prisma.userTwoFactorAuth.upsert({
            where: { userId },
            create: {
                userId,
                totpSecret: encryptedSecret,
                isEnabled: false,
                backupCodes: backupCodes.map((code) => encrypt(code)), // Encrypt backup codes
            },
            update: {
                totpSecret: encryptedSecret,
                isEnabled: false,
                backupCodes: backupCodes.map((code) => encrypt(code)),
            },
        });

        return NextResponse.json({
            success: true,
            qrCode: qrCodeDataUrl,
            secret: secret, // Show this so user can manually enter if QR scan fails
            backupCodes: backupCodes, // Show once during setup
        });
    } catch (error) {
        console.error("Failed to setup 2FA:", error);
        return NextResponse.json(
            { success: false, error: "Failed to setup 2FA" },
            { status: 500 }
        );
    }
}
