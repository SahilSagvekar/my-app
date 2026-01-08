// src/app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadOnCloudinary } from "../../config/cloudinary";
import { jwtVerify } from "jose";
import sharp from "sharp";

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "your-secret-key"
);

// Helper function to get user from token
async function getUserFromToken(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    console.log("Authorization header:", authHeader);
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No valid authorization header");
      return null;
    }

    const token = authHeader.substring(7);
    console.log("Token received:", token.substring(0, 50) + "...");
    
    const verified = await jwtVerify(token, JWT_SECRET);
    console.log("Token verified:", verified.payload);
    
    return verified.payload as any;
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

// GET - Fetch user profile
export async function GET(req: NextRequest) {
  try {
    const decoded = await getUserFromToken(req);

    if (!decoded?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT - Update user profile with image upload
export async function PUT(req: NextRequest) {
  try {
    const decoded = await getUserFromToken(req);

    if (!decoded?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const role = formData.get("role") as string;
    const imageFile = formData.get("image") as File | null;

    // Find existing user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    let imageUrl = user.image;

    // Handle image upload if provided
    if (imageFile && imageFile.size > 0) {
      try {
        const buffer = await imageFile.arrayBuffer();
        let fileBuffer = Buffer.from(buffer);

        // Compress image with sharp before uploading
        try {
          fileBuffer = await sharp(fileBuffer)
            .resize(500, 500, { fit: "cover" })
            .jpeg({ quality: 80 })
            .toBuffer();
        } catch (compressError) {
          console.warn("Image compression failed, uploading original:", compressError);
        }

        // Upload to Cloudinary
        const uploadedUrl = await uploadOnCloudinary(
          fileBuffer,
          "user-profiles"
        );

        if (!uploadedUrl) {
          return NextResponse.json(
            { error: "Failed to upload image" },
            { status: 500 }
          );
        }

        imageUrl = uploadedUrl;
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    // Update user profile in database
    const updatedUser = await prisma.user.update({
      where: { id: decoded.userId },
      data: {
        name: name || user.name,
        phone: phone || user.phone,
        role: role || user.role,
        image: imageUrl,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Failed to update profile", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}