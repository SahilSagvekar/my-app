// src/app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadOnCloudinary } from "../../config/cloudinary";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

import { cookies } from "next/headers";

// Helper function to get token - refined for Next.js 15
async function getToken(req: NextRequest): Promise<string | null> {
  // Try getting from cookies first (standard Next.js approach)
  const cookieStore = await cookies();
  const token = cookieStore.get("authToken")?.value;
  if (token) return token;

  // Fallback to manual header parsing if needed (sometimes useful in certain proxy setups)
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/authToken=([^;]+)/);
    if (match) return match[1];
  }

  // Fallback to Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

// Helper function to verify token and get user data
function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("[PROFILE API] JWT_SECRET is not configured in environment");
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    // Convert userId to number if it's a string, ensuring Prisma compatibility
    const userId = typeof decoded.userId === 'string'
      ? parseInt(decoded.userId, 10)
      : (typeof decoded.userId === 'number' ? decoded.userId : NaN);

    if (isNaN(userId)) {
      console.error("[PROFILE API] Invalid userId in token:", decoded.userId);
      return null;
    }

    return {
      userId,
      role: decoded.role
    };
  } catch (error) {
    console.error("[PROFILE API] Token verification failed:", error);
    return null;
  }
}

import { getCurrentUser2 } from "@/lib/auth";

// GET - Fetch user profile
export async function GET(req: any) {
  const url = new URL(req.url);
  console.log(`[PROFILE API] GET ${url.pathname} - Start`);
  try {
    const user = await getCurrentUser2(req);

    if (!user) {
      console.warn("[PROFILE API] No user found in request");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
        joinedAt: true,
        employeeStatus: true,
        hourlyRate: true,
        monthlyRate: true,
        hoursPerWeek: true,
        monthlyBaseHours: true,
        emailNotifications: true,
        slackUserId: true,
        slackNotifications: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: dbUser });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT - Update user profile with image upload
export async function PUT(req: any) {
  console.log("[PROFILE API] PUT request received");
  try {
    const user = await getCurrentUser2(req);

    if (!user) {
      console.warn("[PROFILE API] No user found in request");
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log("Updating profile for userId:", userId);

    // Parse FormData
    let formData;
    try {
      formData = await req.formData();
    } catch (formError) {
      console.error("Failed to parse FormData:", formError);
      return NextResponse.json(
        { success: false, error: "Invalid form data" },
        { status: 400 }
      );
    }

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const emailNotifications = formData.get("emailNotifications") as string;
    const imageFile = formData.get("image") as File | null;

    console.log("Received data:", { name, phone, emailNotifications, hasImage: !!imageFile });

    // Find existing user
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    let imageUrl = dbUser.image;

    // Handle image upload if provided
    if (imageFile && imageFile.size > 0) {
      try {
        console.log("Processing image upload, size:", imageFile.size);
        const buffer = await imageFile.arrayBuffer();
        let fileBuffer = Buffer.from(buffer);

        // Compress image with sharp before uploading - Dynamic import to avoid module load failure if sharp is missing
        try {
          const sharp = (await import("sharp")).default;
          fileBuffer = await sharp(fileBuffer)
            .resize(500, 500, { fit: "cover" })
            .jpeg({ quality: 80 })
            .toBuffer();
          console.log("Image compressed successfully with sharp");
        } catch (sharpError) {
          console.warn(
            "Sharp compression failed or not available, uploading original:",
            sharpError
          );
        }

        // Upload to Cloudinary
        const uploadedUrl = await uploadOnCloudinary(
          fileBuffer,
          "user-profiles"
        );

        if (!uploadedUrl) {
          console.error("Cloudinary upload returned null");
          return NextResponse.json(
            { success: false, error: "Failed to upload image to cloud storage" },
            { status: 500 }
          );
        }

        imageUrl = uploadedUrl;
        console.log("Image uploaded successfully:", imageUrl);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return NextResponse.json(
          { success: false, error: "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    // Build update data - only include fields that have values
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name && name.trim()) {
      updateData.name = name.trim();
    }
    if (phone !== undefined) {
      updateData.phone = phone?.trim() || null;
    }
    if (imageUrl !== dbUser.image) {
      updateData.image = imageUrl;
    }

    if (emailNotifications !== null) {
      updateData.emailNotifications = emailNotifications === "true";
    }

    console.log("Updating user with data:", updateData);

    // Update user profile in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
        emailNotifications: true,
        updatedAt: true,
      },
    });

    console.log("User updated successfully:", updatedUser.id);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);

    // Check for Prisma errors
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);

      if (error.message.includes("Unknown argument")) {
        return NextResponse.json(
          { success: false, error: "Invalid field in update" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update profile",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}