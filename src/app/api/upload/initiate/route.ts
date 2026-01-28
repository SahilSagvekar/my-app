import { NextRequest, NextResponse } from "next/server";
import { S3Client, CreateMultipartUploadCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import getServerSession from "next-auth";
// import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// 🔥 Helper: Ensure folder exists in S3
async function ensureS3FolderExists(folderPath: string) {
  if (!folderPath || folderPath === "" || folderPath === "/") return;
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: folderPath.endsWith("/") ? folderPath : `${folderPath}/`,
        ContentType: "application/x-directory",
      })
    );
    console.log(`✅ Folder created/verified: ${folderPath}`);
  } catch (error) {
    console.error(`❌ Failed to create folder: ${folderPath}`, error);
    throw error;
  }
}

// 🔥 Helper: Create task folder structure (NO "task" subfolder)
async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string
): Promise<string> {
  // Main task folder: CompanyName/outputs/TaskTitle/
  const taskFolderPath = `${companyName}/outputs/${taskTitle}/`;

  console.log("📁 Creating task folder structure in parallel:", taskFolderPath);

  // 🔥 Create main folder and subfolders in parallel to save time
  await Promise.all([
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
      taskId,
      clientId,
      folderType,
      taskTitle,
      subfolder, // 🔥 Can be empty string for main folder
    } = body;

    console.log("📤 Upload initiate request:", {
      fileName,
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

      // Create task folder structure
      const taskFolderPath = await createTaskFolderStructure(companyName, taskTitle);

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
      await ensureS3FolderExists(drivePath);
      s3Key = `${drivePath}${fileName}`;
    } else {
      return NextResponse.json(
        { message: "Invalid folder type" },
        { status: 400 }
      );
    }

    console.log("🎯 Final S3 key:", s3Key);

    // Initiate multipart upload
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
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