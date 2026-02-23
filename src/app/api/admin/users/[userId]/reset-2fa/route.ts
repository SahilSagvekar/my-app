// app/api/admin/users/[userId]/reset-2fa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;

    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

function verifyAdmin(token: string): boolean {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: number;
            role: string;
        };
        return decoded.role === "admin";
    } catch (error) {
        return false;
    }
}

// POST - Admin reset a user's 2FA (disable it)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const token = getTokenFromCookies(req);

        if (!token || !verifyAdmin(token)) {
            return NextResponse.json(
                { success: false, error: "Unauthorized - Admin only" },
                { status: 401 }
            );
        }

        const awaitedParams = await params;
        const userId = parseInt(awaitedParams.userId);

        if (isNaN(userId)) {
            return NextResponse.json(
                { success: false, error: "Invalid user ID" },
                { status: 400 }
            );
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { twoFactorAuth: true }
        });

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        if (!user.twoFactorAuth) {
            return NextResponse.json({
                success: true,
                message: "2FA is already disabled for this user",
            });
        }

        // Delete the 2FA record
        await prisma.userTwoFactorAuth.delete({
            where: { userId },
        });

        // Log this action in AuditLog
        const adminDecoded = jwt.decode(token) as { userId: number, name: string };
        await prisma.auditLog.create({
            data: {
                action: "RESET_2FA",
                entity: "User",
                entityId: String(userId),
                details: `Admin reset 2FA for user: ${user.name || user.email}`,
                userId: adminDecoded.userId,
                ipAddress: req.ip || "unknown",
                userAgent: req.headers.get("user-agent") || "unknown",
                metadata: {
                    userEmail: user.email,
                    userName: user.name,
                    adminId: adminDecoded.userId
                }
            }
        });

        return NextResponse.json({
            success: true,
            message: `2FA has been reset for user ${user.name || user.email}`,
        });
    } catch (error) {
        console.error("Failed to reset 2FA:", error);
        return NextResponse.json(
            { success: false, error: "Failed to reset 2FA" },
            { status: 500 }
        );
    }
}
