// app/api/feedback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

// GET - Fetch all feedback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const userRole = searchParams.get("userRole");

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
          senderId: parseInt(userId || "0"),
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