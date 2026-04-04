export const dynamic = 'force-dynamic';
// app/api/logins/2fa/disable/route.ts
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
    const period = 30;
    const digits = 6;
    const currentTime = Math.floor(Date.now() / 1000);

    console.log(`[2FA Debug] Server time: ${new Date().toISOString()}`);
    console.log(`[2FA Debug] Unix time: ${currentTime}`);
    console.log(`[2FA Debug] Input code: ${code}`);

    for (let i = -2; i <= 2; i++) {
        const timeStep = Math.floor((currentTime + i * period) / period);
        const generatedCode = generateTotp(secret, timeStep, digits);
        console.log(`[2FA Debug] Window ${i}: generated=${generatedCode}, match=${generatedCode === code}`);
        if (generatedCode === code) {
            return true;
        }
    }
    return false;
}

function generateTotp(secret: string, timeStep: number, digits: number): string {
    const timeBuffer = Buffer.alloc(8);
    let tempTime = timeStep;
    for (let i = 7; i >= 0; i--) {
        timeBuffer[i] = tempTime & 0xff;
        tempTime = Math.floor(tempTime / 256);
    }

    const secretBuffer = base32Decode(secret);
    const hmac = crypto.createHmac("sha1", secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

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

// POST - Disable 2FA (requires current TOTP code for security)
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
        const { code } = body;

        if (!code || typeof code !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Verification code is required to disable 2FA",
                },
                { status: 400 }
            );
        }

        // Get user's 2FA settings
        const twoFactorAuth = await prisma.userTwoFactorAuth.findUnique({
            where: { userId },
        });

        if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
            return NextResponse.json(
                { success: false, error: "2FA is not enabled" },
                { status: 400 }
            );
        }

        // Decrypt the secret
        const secret = decrypt(twoFactorAuth.totpSecret);

        // Verify the TOTP code before disabling
        const cleanCode = code.replace(/\s/g, "");
        const isValid = verifyTotpCode(secret, cleanCode);

        if (!isValid) {
            return NextResponse.json(
                { success: false, error: "Invalid verification code" },
                { status: 401 }
            );
        }

        // Delete the 2FA record
        await prisma.userTwoFactorAuth.delete({
            where: { userId },
        });

        return NextResponse.json({
            success: true,
            message: "2FA has been disabled successfully",
        });
    } catch (error) {
        console.error("Failed to disable 2FA:", error);
        return NextResponse.json(
            { success: false, error: "Failed to disable 2FA" },
            { status: 500 }
        );
    }
}
