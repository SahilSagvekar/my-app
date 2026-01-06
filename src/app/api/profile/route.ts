// // src/api/profile/route.ts
// import { Router, Request, Response } from "express";
// import { getServerSession } from "next-auth";
// import { prisma } from "@/lib/prisma";
// // import { uploadOnCloudinary } from "@/app/config/cloudinary";
// // import upload from "@/app/config/multer";
// import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// import { uploadOnCloudinary } from "../../config/cloudinary";
// import upload from "../../config/multer";

// const router = Router();

// // GET - Fetch user profilecloudinary
// router.get("/", async (req: Request, res: Response) => {
//   try {
//     const session = await getServerSession(authOptions);

//     if (!session?.user?.email) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     const user = await prisma.user.findUnique({
//       where: { email: session.user.email },
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         image: true,
//         phone: true,
//         role: true,
//         hourlyRate: true,
//         monthlyRate: true,
//         monthlyBaseHours: true,
//         employeeStatus: true,
//         joinedAt: true,
//         hoursPerWeek: true,
//         worksOnSaturday: true,
//       },
//     });

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     return res.status(200).json({ success: true, data: user });
//   } catch (error) {
//     return res.status(500).json({ error: "Failed to fetch profile" });
//   }
// });

// // PUT - Update user profile with image upload
// router.put("/", upload.single("image"), async (req: Request, res: Response) => {
//   try {
//     const session = await getServerSession(authOptions);

//     if (!session?.user?.email) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     const { name, phone, hourlyRate, monthlyRate, monthlyBaseHours, hoursPerWeek, worksOnSaturday } = req.body;

//     // Find existing user
//     const user = await prisma.user.findUnique({
//       where: { email: session.user.email },
//     });

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     let imageUrl = user.image;

//     // Handle image upload if provided
//     if (req.file) {
//       try {
//         // Upload to Cloudinary using your existing function
//         const uploadedUrl = await uploadOnCloudinary(
//           req.file.buffer,
//           "user-profiles"
//         );

//         if (!uploadedUrl) {
//           return res.status(500).json({ error: "Failed to upload image" });
//         }

//         imageUrl = uploadedUrl;
//       } catch (uploadError) {
//         return res.status(500).json({ error: "Failed to upload image" });
//       }
//     }

//     // Update user profile in database
//     const updatedUser = await prisma.user.update({
//       where: { email: session.user.email },
//       data: {
//         name: name || user.name,
//         phone: phone || user.phone,
//         hourlyRate: hourlyRate ? parseFloat(hourlyRate) : user.hourlyRate,
//         monthlyRate: monthlyRate ? parseInt(monthlyRate) : user.monthlyRate,
//         monthlyBaseHours: monthlyBaseHours ? parseInt(monthlyBaseHours) : user.monthlyBaseHours,
//         hoursPerWeek: hoursPerWeek ? parseFloat(hoursPerWeek) : user.hoursPerWeek,
//         worksOnSaturday: worksOnSaturday === "true",
//         image: imageUrl,
//         updatedAt: new Date(),
//       },
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         image: true,
//         phone: true,
//         role: true,
//         hourlyRate: true,
//         monthlyRate: true,
//         monthlyBaseHours: true,
//         employeeStatus: true,
//         joinedAt: true,
//         hoursPerWeek: true,
//         worksOnSaturday: true,
//         updatedAt: true,
//       },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Profile updated successfully",
//       data: updatedUser,
//     });
//   } catch (error) {
//     return res.status(500).json({ error: "Failed to update profile" });
//   }
// });

// export default router;




// src/app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { uploadOnCloudinary } from "../../config/cloudinary";
import upload from "../../config/multer";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// GET - Fetch user profile
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        role: true,
        hourlyRate: true,
        monthlyRate: true,
        monthlyBaseHours: true,
        employeeStatus: true,
        joinedAt: true,
        hoursPerWeek: true,
        worksOnSaturday: true,
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
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PUT - Update user profile with image upload
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const hourlyRate = formData.get("hourlyRate") as string;
    const monthlyRate = formData.get("monthlyRate") as string;
    const monthlyBaseHours = formData.get("monthlyBaseHours") as string;
    const hoursPerWeek = formData.get("hoursPerWeek") as string;
    const worksOnSaturday = formData.get("worksOnSaturday") as string;
    const imageFile = formData.get("image") as File | null;

    // Find existing user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
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
        const fileBuffer = Buffer.from(buffer);

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
        return NextResponse.json(
          { error: "Failed to upload image" },
          { status: 500 }
        );
      }
    }

    // Update user profile in database
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: name || user.name,
        phone: phone || user.phone,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : user.hourlyRate,
        monthlyRate: monthlyRate ? parseInt(monthlyRate) : user.monthlyRate,
        monthlyBaseHours: monthlyBaseHours
          ? parseInt(monthlyBaseHours)
          : user.monthlyBaseHours,
        hoursPerWeek: hoursPerWeek ? parseFloat(hoursPerWeek) : user.hoursPerWeek,
        worksOnSaturday: worksOnSaturday === "true",
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
        hourlyRate: true,
        monthlyRate: true,
        monthlyBaseHours: true,
        employeeStatus: true,
        joinedAt: true,
        hoursPerWeek: true,
        worksOnSaturday: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}