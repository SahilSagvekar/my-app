// src/app/api/profile/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadOnCloudinary } from "../../config/cloudinary";
import jwt from "jsonwebtoken";
import sharp from "sharp";

// Helper function to get token from cookies
function getTokenFromCookies(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// Helper function to verify token and get user data
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

// GET - Fetch user profile
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);

    // No cookie = not logged in
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT - Update user profile with image upload
export async function PUT(req: NextRequest) {
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
    const imageFile = formData.get("image") as File | null;

    console.log("Received data:", { name, phone, hasImage: !!imageFile });

    // Find existing user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    let imageUrl = user.image;

    // Handle image upload if provided
    if (imageFile && imageFile.size > 0) {
      try {
        console.log("Processing image upload, size:", imageFile.size);
        const buffer = await imageFile.arrayBuffer();
        let fileBuffer = Buffer.from(buffer);

        // Compress image with sharp before uploading
        try {
          fileBuffer = await sharp(fileBuffer)
            .resize(500, 500, { fit: "cover" })
            .jpeg({ quality: 80 })
            .toBuffer();
          console.log("Image compressed successfully");
        } catch (compressError) {
          console.warn(
            "Image compression failed, uploading original:",
            compressError
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
    if (imageUrl !== user.image) {
      updateData.image = imageUrl;
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