import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Ensure this points to your Prisma instance

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        // driveFolderId: true, // Include folder ID for reference
        driveFolderId: true,
        rawFolderId: true,
        essentialsFolderId: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log("Fetched clients:", clients);
    return NextResponse.json({ success: true, data: clients });

  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
