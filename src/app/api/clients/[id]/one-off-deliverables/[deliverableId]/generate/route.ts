export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3, BUCKET } from "@/lib/s3";

const s3Client = getS3();

const WEEKDAY_MAP: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
};

function getDeliverableShortCode(type: string): string {
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

function formatDateMMDDYYYY(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
}

function parseTimeToDate(base: Date, timeStr: string): Date {
    const [hh, mm] = timeStr.split(":").map(Number);
    const d = new Date(base);
    d.setHours(hh, mm ?? 0, 0, 0);
    return d;
}

function getCurrentMonthFolder(): string {
    const date = new Date();
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${month}-${year}`;
}

async function createTaskFolderStructure(
    companyName: string,
    taskTitle: string,
    monthFolder: string
): Promise<string> {
    // Monthly grouped path: CompanyName/outputs/Month-Year/TaskTitle/
    const monthFolderPath = `${companyName}/outputs/${monthFolder}/`;
    const taskFolderPath = `${monthFolderPath}${taskTitle}/`;
    try {
        const folders = [
            monthFolderPath,
            taskFolderPath,
            `${taskFolderPath}thumbnails/`,
            `${taskFolderPath}tiles/`,
            `${taskFolderPath}music-license/`,
        ];
        await Promise.all(
            folders.map((folder) =>
                s3Client.send(
                    new PutObjectCommand({
                        Bucket: BUCKET,
                        Key: folder,
                        ContentType: "application/x-directory",
                    })
                )
            )
        );
        return taskFolderPath;
    } catch (error) {
        console.error("❌ Failed to create task folder:", error);
        throw error;
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
    try {
        const { id: clientId, deliverableId } = await params;

        const deliverable = await prisma.oneOffDeliverable.findFirst({
            where: { id: deliverableId, clientId },
            include: { client: true }
        });

        if (!deliverable) {
            return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
        }

        if (deliverable.status === "GENERATED") {
            return NextResponse.json({ error: "Tasks already generated for this deliverable" }, { status: 400 });
        }

        const now = new Date();
        const createdDateStr = formatDateMMDDYYYY(now);
        const companyName = deliverable.client.companyName || deliverable.client.name;
        const clientSlug = deliverable.client.name.replace(/\s+/g, "");
        const deliverableSlug = getDeliverableShortCode(deliverable.type);

        // Default user for assignment
        const defaultUser = await prisma.user.findFirst({
            where: { role: { in: ["admin", "manager"] }, employeeStatus: "ACTIVE" },
            select: { id: true },
        });

        const createdTasks = [];
        const quantity = deliverable.quantity;
        const videosPerDay = deliverable.videosPerDay || 1;
        const times = [...deliverable.postingTimes];
        while (times.length < videosPerDay) times.push(times[times.length - 1] || "10:00");

        // Simple generation: spread tasks across days starting from today if postingDays is available, 
        // otherwise just put them all on "now" or spread by days.
        // For one-offs, we'll just spread them by days if postingDays is empty.

        let currentTaskDate = new Date(now);
        let tasksCreated = 0;

        while (tasksCreated < quantity) {
            // Find next valid date if postingDays is used
            if (deliverable.postingDays.length > 0) {
                const targetWeekdays = deliverable.postingDays.map(d => WEEKDAY_MAP[d]).filter(v => v !== undefined);
                while (targetWeekdays.length > 0 && !targetWeekdays.includes(currentTaskDate.getDay())) {
                    currentTaskDate.setDate(currentTaskDate.getDate() + 1);
                }
            }

            for (let i = 0; i < videosPerDay && tasksCreated < quantity; i++) {
                const taskNumber = tasksCreated + 1;
                const title = `${clientSlug}_${createdDateStr}_${deliverableSlug}${taskNumber}_Project`;
                const taskDueDate = parseTimeToDate(currentTaskDate, times[i]);

                let outputFolderId: string | null = null;
                const monthFolder = getCurrentMonthFolder();
                try {
                    outputFolderId = await createTaskFolderStructure(companyName, title, monthFolder);
                } catch (error) {
                    console.error(`⚠️ S3 folder creation failed for ${title}`);
                }

                const newTask = await prisma.task.create({
                    data: {
                        title,
                        description: deliverable.description || "",
                        taskType: deliverable.type,
                        status: "PENDING",
                        dueDate: taskDueDate,
                        assignedTo: defaultUser?.id || 1, // Fallback
                        clientId,
                        clientUserId: deliverable.client.userId,
                        oneOffDeliverableId: deliverable.id,
                        outputFolderId,
                        monthFolder,
                        isTrial: deliverable.isTrial ?? deliverable.client.isTrial ?? false,
                    },
                });
                createdTasks.push(newTask);
                tasksCreated++;
            }
            currentTaskDate.setDate(currentTaskDate.getDate() + 1);
        }

        // Update deliverable status
        await prisma.oneOffDeliverable.update({
            where: { id: deliverableId },
            data: { status: "GENERATED" }
        });

        return NextResponse.json({
            success: true,
            message: `Successfully generated ${createdTasks.length} tasks`,
            tasks: createdTasks.map(t => ({ id: t.id, title: t.title }))
        });

    } catch (err) {
        console.error("❌ Task generation failed:", err);
        return NextResponse.json({ error: "Server error", message: String(err) }, { status: 500 });
    }
}