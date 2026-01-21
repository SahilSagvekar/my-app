// app/api/logins/2fa/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

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

// GET - Check if user has 2FA enabled
export async function GET(req: NextRequest) {
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

        // Get user's 2FA settings
        const twoFactorAuth = await prisma.userTwoFactorAuth.findUnique({
            where: { userId },
            select: {
                isEnabled: true,
                createdAt: true,
                lastVerifiedAt: true,
                backupCodes: true,
            },
        });

        if (!twoFactorAuth) {
            return NextResponse.json({
                success: true,
                has2FA: false,
                isEnabled: false,
            });
        }

        return NextResponse.json({
            success: true,
            has2FA: true,
            isEnabled: twoFactorAuth.isEnabled,
            createdAt: twoFactorAuth.createdAt,
            lastVerifiedAt: twoFactorAuth.lastVerifiedAt,
            remainingBackupCodes: twoFactorAuth.backupCodes.length,
        });
    } catch (error) {
        console.error("Failed to check 2FA status:", error);
        return NextResponse.json(
            { success: false, error: "Failed to check 2FA status" },
            { status: 500 }
        );
    }
}
