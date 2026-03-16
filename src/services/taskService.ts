import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { addSignedUrlsToFiles } from "@/lib/s3";
import { resolveClientIdForUser } from "@/lib/auth";
import { ServerTiming } from "@/lib/server-timing";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export class TaskService {
  static getCurrentMonthFolder(): string {
    const date = new Date();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    return `${month}-${year}`;
  }

  static getDeliverableShortCode(type: string) {
    const normalized = type.toLowerCase().trim();
    if (normalized === "short form videos") return "SF";
    if (normalized === "long form videos") return "LF";
    if (normalized === "square form videos") return "SQF";
    if (normalized === "thumbnails") return "THUMB";
    if (normalized === "tiles") return "T";
    if (normalized === "hard posts / graphic images") return "HP";
    if (normalized === "snapchat episodes") return "SEP";
    if (normalized === "beta short form") return "BSF";
    return type.replace(/\s+/g, "");
  }

  static formatDateMMDDYYYY(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  }

  static sanitizeBigInt(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return Number(obj);
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(this.sanitizeBigInt.bind(this));
    if (typeof obj === "object") {
      const newObj: any = {};
      for (const key in obj) {
        newObj[key] = this.sanitizeBigInt(obj[key]);
      }
      return newObj;
    }
    return obj;
  }

  static async buildRoleWhereQuery(role: string | null, userId: number): Promise<any> {
    if (!role) return {};

    switch (role.toLowerCase()) {
      case "editor":
        return {
          AND: [
            { assignedTo: userId },
            { status: { in: ["PENDING", "IN_PROGRESS", "READY_FOR_QC", "REJECTED"] } },
          ],
        };
      case "qc":
        return {
          AND: [
            { qc_specialist: userId },
            { status: { in: ["READY_FOR_QC", "COMPLETED", "REJECTED", "CLIENT_REVIEW"] } },
          ],
        };
      case "scheduler":
        return {
          AND: [
            { scheduler: userId },
            { status: { in: ["COMPLETED", "SCHEDULED"] } },
          ],
        };
      case "client": {
        const resolvedClientId = await resolveClientIdForUser(userId);
        if (resolvedClientId) {
          return {
            AND: [
              { clientId: resolvedClientId },
              { status: { in: ["CLIENT_REVIEW", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "POSTED"] } },
            ],
          };
        }
        return {
          AND: [
            { clientUserId: Number(userId) },
            { status: { in: ["CLIENT_REVIEW", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "POSTED"] } },
          ],
        };
      }
      case "videographer":
        return {
          AND: [
            { videographer: userId },
            { status: { in: ["VIDEOGRAPHER_ASSIGNED"] } },
          ],
        };
      case "manager":
      case "admin":
        return {};
      default:
        return { assignedTo: userId };
    }
  }

  static extractSortParts(title: string | null) {
    if (!title) return { company: '', date: '', prefix: '', number: 0 };
    const match = title.match(/^(.+)_(\d{2}-\d{2}-\d{4})_([a-zA-Z]+)(\d+)$/);
    if (match) {
      return {
        company: match[1].toLowerCase(),
        date: match[2],
        prefix: match[3].toLowerCase(),
        number: parseInt(match[4], 10)
      };
    }
    return { company: title.toLowerCase(), date: '', prefix: '', number: 0 };
  }

  static async getTasks(
    role: string | null, 
    userId: number, 
    filters: { status?: string, clientId?: string, month?: string },
    timing?: ServerTiming
  ) {
    timing?.start('db-where');
    const where = await this.buildRoleWhereQuery(role, userId);
    timing?.stop('db-where');
    
    if (filters.status) {
      const statuses = filters.status.split(",");
      if (where.AND) where.AND.push({ status: { in: statuses } });
      else where.status = { in: statuses };
    }
    
    if (filters.clientId) {
      if (where.AND) where.AND.push({ clientId: filters.clientId });
      else where.clientId = filters.clientId;
    }

    if (filters.month) {
      if (where.AND) where.AND.push({ monthFolder: filters.month });
      else where.monthFolder = filters.month;
    }

    try {
      timing?.start('db-fetch');
      const tasksWithRelations = await prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { name: true, companyName: true } },
          user: { select: { name: true, role: true } },
          files: true,
          taskFeedback: { select: { feedback: true, createdAt: true } },
        },
      });
      timing?.stop('db-fetch');

      // Apply Smart Sort with pre-calculated keys
      timing?.start('sort');
      const tasksWithKeys = tasksWithRelations.map(task => ({
        task,
        sortedKey: this.extractSortParts(task.title)
      }));

      tasksWithKeys.sort((a, b) => {
        const taskA = a.sortedKey;
        const taskB = b.sortedKey;
        if (taskA.company !== taskB.company) return taskA.company.localeCompare(taskB.company);
        if (taskA.date !== taskB.date) {
          const dateA = taskA.date.split('-').reverse().join('');
          const dateB = taskB.date.split('-').reverse().join('');
          return dateA.localeCompare(dateB);
        }
        if (taskA.prefix !== taskB.prefix) return taskA.prefix.localeCompare(taskB.prefix);
        return taskA.number - taskB.number;
      });

      const sortedTasks = tasksWithKeys.map(k => k.task);
      timing?.stop('sort');

      return sortedTasks;
    } catch (e: any) {
      console.error("[TASK_SERVICE] prisma relation fetch failed", e);
      throw e;
    }
  }

  static async signTaskFiles(tasks: any[], timing?: ServerTiming) {
    timing?.start('s3-sign');
    const signed = await Promise.all(
      tasks.map(async (task) => {
        if (task.files && task.files.length > 0) {
          const signedFiles = await addSignedUrlsToFiles(task.files);
          return { ...task, files: signedFiles };
        }
        return task;
      })
    );
    timing?.stop('s3-sign');
    return signed;
  }

  static async createTaskFolderStructure(
    companyName: string,
    taskTitle: string,
    monthFolder?: string
  ): Promise<string> {
    const outputBase = monthFolder
      ? `${companyName}/outputs/${monthFolder}/`
      : `${companyName}/outputs/`;
    const taskFolderPath = `${outputBase}${taskTitle}/`;

    await Promise.all([
      ...(monthFolder ? [s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: outputBase,
        ContentType: "application/x-directory",
      }))] : []),
      s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: taskFolderPath,
        ContentType: "application/x-directory",
      })),
      s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `${taskFolderPath}thumbnails/`,
        ContentType: "application/x-directory",
      })),
      s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `${taskFolderPath}tiles/`,
        ContentType: "application/x-directory",
      })),
      s3Client.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `${taskFolderPath}music-license/`,
        ContentType: "application/x-directory",
      }))
    ]);

    return taskFolderPath;
  }

  static async createTask(data: any, files: File[], user: any) {
    const { 
      description, dueDate, assignedTo, qc_specialist, scheduler, videographer, 
      clientId, folderType, monthlyDeliverableId, oneOffDeliverableId,
      shootLocation, shootDate, shootCamera, shootQuality, shootFrameRate,
      shootLighting, shootExclusions, shootReferenceLinks
    } = data;

    const { id: userId, role } = user;

    // 📁 GET CLIENT
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        companyName: true,
        rawFootageFolderId: true,
        essentialsFolderId: true,
        requiresClientReview: true,
        requiresVideographer: true,
        userId: true,
      },
    });

    if (!client) throw new Error("Client not found");

    // Folder Logic
    let folderPrefix = '';
    const effectiveFolderType = folderType || 'rawFootage';

    if (effectiveFolderType === "rawFootage") {
      const companyName = client.companyName || client.name;
      const currentMonth = this.getCurrentMonthFolder();
      const rawFootageBase = client.rawFootageFolderId || `${companyName}/raw-footage/`;
      folderPrefix = `${rawFootageBase}${currentMonth}/`;

      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: folderPrefix,
          ContentType: "application/x-directory",
        }));
      } catch (error) {
        console.log('⚠️ Folder might already exist (ok):', error);
      }
    } else {
      folderPrefix = client.essentialsFolderId || '';
    }

    // 📝 CREATE TASK
    const task = await prisma.task.create({
      data: {
        title: "",
        description: description || "",
        dueDate: new Date(dueDate),
        assignedTo,
        qc_specialist,
        scheduler,
        videographer,
        createdBy: userId,
        clientId: clientId,
        clientUserId: client?.userId,
        monthlyDeliverableId: monthlyDeliverableId || null,
        oneOffDeliverableId: oneOffDeliverableId || null,
        driveLinks: [],
        folderType: effectiveFolderType,
        monthFolder: this.getCurrentMonthFolder(),
        requiresClientReview: client.requiresClientReview,
        status: (client.requiresVideographer || shootLocation || shootCamera)
          ? "VIDEOGRAPHER_ASSIGNED"
          : "PENDING",
      },
    });

    // Audit & Notification
    const { createAuditLog, AuditAction } = await import("@/lib/audit-logger");
    const { notifyUser } = await import("@/lib/notify");

    await createAuditLog({
      userId: userId,
      action: AuditAction.TASK_CREATED,
      entity: 'Task',
      entityId: task.id,
      details: `Created task: ${task.title}`,
      metadata: { taskId: task.id, assignedTo: assignedTo, status: task.status },
    });

    try {
      await notifyUser({
        userId: assignedTo,
        type: "task_assigned",
        title: "New Task Assigned",
        body: `You have been assigned a new task: ${task.title || "Untitled"}`,
        payload: { taskId: task.id, clientId: task.clientId }
      });
    } catch (err) {
      console.error("Failed to send assignment notification:", err);
    }

    // 📤 UPLOAD FILES
    const uploadedLinks: string[] = [];
    const { uploadBufferToS3 } = await import("@/lib/s3");

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix,
        filename: file.name,
        mimeType: file.type,
      });

      uploadedLinks.push(uploaded.url);

      await prisma.file.create({
        data: {
          taskId: task.id,
          name: file.name,
          url: uploaded.url,
          mimeType: file.type,
          size: BigInt(buffer.length),
          uploadedBy: userId,
        },
      });
    }

    // Update with URLs
    await prisma.task.update({
      where: { id: task.id },
      data: { driveLinks: uploadedLinks },
    });

    // Handle Shoot Details
    if (shootLocation || shootDate || shootCamera || shootReferenceLinks) {
      const referenceLinksArray = shootReferenceLinks
        ? shootReferenceLinks.split(',').map((l: string) => l.trim()).filter(Boolean)
        : [];

      await (prisma as any).shootDetail.create({
        data: {
          taskId: task.id,
          location: shootLocation || null,
          shootDate: shootDate ? new Date(shootDate) : null,
          camera: shootCamera || null,
          quality: shootQuality || null,
          frameRate: shootFrameRate || null,
          lighting: shootLighting || null,
          exclusions: shootExclusions || null,
          referenceLinks: referenceLinksArray,
          videographerId: videographer || null
        }
      });
    }

    // 🔁 AUTO GENERATE / ONE-OFF HANDLING
    if (monthlyDeliverableId) {
      const { generateMonthlyTasksFromTemplate } = await import("@/lib/recurring/generateMonthly");
      await generateMonthlyTasksFromTemplate(task.id, monthlyDeliverableId);
      return await prisma.task.findUnique({ where: { id: task.id } }) || task;
    } else if (oneOffDeliverableId) {
      const deliverable = await prisma.oneOffDeliverable.findUnique({ where: { id: oneOffDeliverableId } });
      if (deliverable) {
        const existingCount = await prisma.task.count({ where: { clientId, oneOffDeliverableId: deliverable.id } });
        const companyName = client.companyName || client.name;
        const companyNameSlug = companyName.replace(/\s/g, '');
        const deliverableSlug = this.getDeliverableShortCode(deliverable.type);
        const createdAtStr = this.formatDateMMDDYYYY(task.createdAt);
        const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${existingCount}`;
        const taskFolderPath = await this.createTaskFolderStructure(companyName, title, this.getCurrentMonthFolder());

        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { title, outputFolderId: taskFolderPath }
        });

        if (role?.toLowerCase() === 'editor') {
          await notifyUser({
            userId: null,
            type: "task_created",
            title: "New Task Created",
            body: `${user.name || user.email} has created a task for ${client.name}`,
            payload: { taskId: task.id, clientId: task.clientId }
          });
        }
        return updated;
      }
    }

    return task;
  }

  static async getAvailableMonths() {
    const distinctMonths = await prisma.task.findMany({
      where: { monthFolder: { not: null } },
      select: { monthFolder: true },
      distinct: ['monthFolder'],
      orderBy: { monthFolder: 'desc' },
    });
    return distinctMonths.map((t: any) => t.monthFolder as string).filter(Boolean);
  }
}
