export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { CreateMultipartUploadCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import getServerSession from "next-auth";
// import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getS3, BUCKET } from "@/lib/s3";
import { getClientStorageInfo, DEFAULT_STORAGE_LIMIT } from "@/lib/storage-service";

const s3Client = getS3();

// 🔥 Helper: Ensure folder exists in S3 (creates all intermediate folders)
async function ensureS3FolderExists(folderPath: string) {
  if (!folderPath || folderPath === "" || folderPath === "/") return;
  
  // Normalize path - remove leading/trailing slashes and split
  const normalizedPath = folderPath.replace(/^\/+|\/+$/g, '');
  const parts = normalizedPath.split('/').filter(Boolean);
  
  // Create each folder level progressively
  let currentPath = '';
  for (const part of parts) {
    currentPath += `${part}/`;
    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: currentPath,
          ContentType: "application/x-directory",
        })
      );
      console.log(`✅ Folder created/verified: ${currentPath}`);
    } catch (error) {
      // Folder might already exist, that's ok - continue
      console.log(`⚠️ Folder might exist (continuing): ${currentPath}`);
    }
  }
}

// 🔥 Helper: Create task folder structure (grouped by month)
async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string,
  monthFolder: string
): Promise<string> {
  // Monthly grouped path: CompanyName/outputs/Month-Year/TaskTitle/
  const monthFolderPath = `${companyName}/outputs/${monthFolder}/`;
  const taskFolderPath = `${monthFolderPath}${taskTitle}/`;

  console.log("📁 Creating task folder structure in parallel:", taskFolderPath);

  // 🔥 Create month folder, main folder and subfolders in parallel to save time
  await Promise.all([
    ensureS3FolderExists(monthFolderPath),
    ensureS3FolderExists(taskFolderPath),
    ensureS3FolderExists(`${taskFolderPath}thumbnails/`),
    ensureS3FolderExists(`${taskFolderPath}tiles/`),
    ensureS3FolderExists(`${taskFolderPath}music-license/`),
  ]);

  console.log("✅ Task folder structure created/verified");

  return taskFolderPath;
}

// 🔥 Helper: Get current month folder name
function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${month}-${year}`;
}

export async function POST(req: NextRequest) {
  try {
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    const body = await req.json();
    const {
      fileName,
      fileType,
      fileSize, // 🔥 For storage limit checking
      taskId,
      clientId,
      folderType,
      taskTitle,
      subfolder, // 🔥 Can be empty string for main folder
      relativePath, // 🔥 For folder uploads — e.g. "my-folder/sub/video.mp4"
    } = body;

    console.log("📤 Upload initiate request:", {
      fileName,
      fileSize,
      taskId,
      clientId,
      folderType,
      taskTitle,
      subfolder: subfolder || "[main folder]",
    });

    if (!fileName || !fileType || !taskId || !clientId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // 🔥 Check storage limit for raw-footage uploads
    const isRawFootageUpload = folderType === "rawFootage" || 
      (folderType === "drive" && subfolder?.includes("raw-footage"));
    
    if (isRawFootageUpload && clientId && clientId !== "unknown") {
      const storageInfo = await getClientStorageInfo(clientId);
      
      // Check if upload would exceed limit
      const projectedUsage = storageInfo.used + (fileSize || 0);
      if (projectedUsage > storageInfo.limit) {
        return NextResponse.json(
          { 
            message: "Storage limit exceeded",
            error: "STORAGE_LIMIT_EXCEEDED",
            storageInfo: {
              used: storageInfo.usedFormatted,
              limit: storageInfo.limitFormatted,
              percentage: storageInfo.percentage,
            }
          },
          { status: 403 }
        );
      }
      
      // Warn if near limit
      if (storageInfo.isAtLimit) {
        return NextResponse.json(
          { 
            message: "Storage limit reached. Please upgrade your plan.",
            error: "STORAGE_LIMIT_REACHED",
            storageInfo: {
              used: storageInfo.usedFormatted,
              limit: storageInfo.limitFormatted,
              percentage: storageInfo.percentage,
            }
          },
          { status: 403 }
        );
      }
    }

    let companyName = "";

    // 🔥 HANDLE DIFFERENT FOLDER TYPES
    if (folderType !== "drive") {
      if (!clientId) {
        return NextResponse.json(
          { message: "Missing clientId" },
          { status: 400 }
        );
      }

      // Get client to find company name
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { companyName: true, name: true },
      });

      if (!client) {
        return NextResponse.json(
          { message: "Client not found" },
          { status: 404 }
        );
      }

      companyName = client.companyName || client.name;
    }

    let s3Key: string;

    // 🔥 HANDLE DIFFERENT FOLDER TYPES
    if (folderType === "outputs") {
      // Outputs folder - create task folder structure
      if (!taskTitle) {
        return NextResponse.json(
          { message: "Task title required for outputs upload" },
          { status: 400 }
        );
      }

      // Create task folder structure (grouped by month)
      const currentMonth = getCurrentMonthFolder();
      const taskFolderPath = await createTaskFolderStructure(companyName, taskTitle, currentMonth);

      // 🔥 Build S3 key based on subfolder
      // if (subfolder && subfolder.trim() !== "") {
      //   // Upload to subfolder: CompanyName/outputs/TaskTitle/subfolder/file.mp4
      //   s3Key = `${taskFolderPath}${subfolder}/${Date.now()}-${fileName}`;
      // } else {
      //   // Upload to main task folder: CompanyName/outputs/TaskTitle/file.mp4
      //   s3Key = `${taskFolderPath}${Date.now()}-${fileName}`;
      // }

      if (subfolder && subfolder.trim() !== "" && subfolder !== "main") {
        // Upload to subfolder: CompanyName/outputs/TaskTitle/subfolder/file.mp4
        s3Key = `${taskFolderPath}${subfolder}/${Date.now()}-${fileName}`;
      } else {
        // Upload to main task folder: CompanyName/outputs/TaskTitle/file.mp4
        s3Key = `${taskFolderPath}${Date.now()}-${fileName}`;
      }
    } else if (folderType === "rawFootage") {
      // Raw footage - with monthly folders
      const currentMonth = getCurrentMonthFolder();
      const monthFolderPath = `${companyName}/raw-footage/${currentMonth}/`;

      await ensureS3FolderExists(monthFolderPath);
      s3Key = `${monthFolderPath}${Date.now()}-${fileName}`;
    } else if (folderType === "essentials") {
      // Elements folder
      const elementsFolderPath = `${companyName}/elements/`;
      await ensureS3FolderExists(elementsFolderPath);
      s3Key = `${elementsFolderPath}${Date.now()}-${fileName}`;
    } else if (folderType === "drive") {
      // Direct drive upload - subfolder contains the full path
      let drivePath = subfolder || "";
      if (drivePath !== "" && !drivePath.endsWith("/")) {
        drivePath += "/";
      }
      // 🔥 Folder upload: relativePath preserves the sub-folder structure
      // e.g. relativePath = "shoot-day-1/raw/clip.mp4" → key = basePath/shoot-day-1/raw/clip.mp4
      if (relativePath) {
        const dirPart = relativePath.split('/').slice(0, -1).join('/');
        if (dirPart) {
          await ensureS3FolderExists(`${drivePath}${dirPart}`);
          s3Key = `${drivePath}${relativePath}`;
        } else {
          await ensureS3FolderExists(drivePath);
          s3Key = `${drivePath}${fileName}`;
        }
      } else {
        await ensureS3FolderExists(drivePath);
        s3Key = `${drivePath}${fileName}`;
      }
    } else {
      return NextResponse.json(
        { message: "Invalid folder type" },
        { status: 400 }
      );
    }

    console.log("🎯 Final S3 key:", s3Key);

    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: s3Key,
      ContentType: fileType,
    });

    const { UploadId } = await s3Client.send(createCommand);

    if (!UploadId) {
      throw new Error("Failed to get upload ID");
    }

    console.log("✅ Multipart upload initiated:", UploadId);

    return NextResponse.json({
      uploadId: UploadId,
      key: s3Key,
    });
  } catch (error: any) {
    console.error("❌ Initiate upload error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to initiate upload" },
      { status: 500 }
    );
  }
}