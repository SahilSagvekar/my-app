export const dynamic = 'force-dynamic';
// app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// GET - Fetch all feedback
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = Number(decoded.userId);
    // Real role from the token, not the ?userRole= query param — that was
    // previously trusted as-is, so anyone could pass userRole=admin and see
    // every submission (including other people's screenshots).
    const userRole = (decoded.role || "").toLowerCase();

    let feedback;

    if (userRole === "admin" || userRole === "manager") {
      // Admin and managers see all feedback
      feedback = await prisma.feedback.findMany({
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          responses: {
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Other users only see their own feedback
      feedback = await prisma.feedback.findMany({
        where: {
          senderId: userId,
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          responses: {
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// POST - Create new feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, message, category, priority, senderId } = body;

    const feedback = await prisma.feedback.create({
      data: {
        subject,
        message,
        category,
        priority,
        status: "pending",
        senderId: parseInt(senderId),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Error creating feedback:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}