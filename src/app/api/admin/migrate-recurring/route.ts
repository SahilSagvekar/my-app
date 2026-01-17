import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * MIGRATION SCRIPT: Set up RecurringTask entries for existing clients
 * 
 * This script:
 * 1. Finds all clients with monthly deliverables
 * 2. For each deliverable, finds the most recent task (to use as template)
 * 3. Creates RecurringTask entries linking client, deliverable, and template
 * 
 * Run once: POST /api/admin/migrate-recurring
 * Preview:  POST /api/admin/migrate-recurring?dryRun=true
 */

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const dryRun = searchParams.get("dryRun") === "true";

        console.log(`🔄 Starting RecurringTask migration${dryRun ? " (DRY RUN)" : ""}...`);

        // Step 1: Find all clients with monthly deliverables
        const clients = await prisma.client.findMany({
            where: {
                status: "ACTIVE",
                monthlyDeliverables: {
                    some: {}, // Has at least one deliverable
                },
            },
            include: {
                monthlyDeliverables: true,
            },
        });

        console.log(`📋 Found ${clients.length} active clients with deliverables`);

        const results = {
            clientsProcessed: 0,
            recurringTasksCreated: 0,
            alreadyExists: 0,
            noTemplateFound: 0,
            details: [] as any[],
        };

        for (const client of clients) {
            console.log(`\n👤 Processing client: ${client.name || client.companyName}`);

            for (const deliverable of client.monthlyDeliverables) {
                // Check if RecurringTask already exists for this client+deliverable
                const existingRecurring = await prisma.recurringTask.findFirst({
                    where: {
                        clientId: client.id,
                        deliverableId: deliverable.id,
                    },
                });

                if (existingRecurring) {
                    console.log(`   ⏭️  RecurringTask already exists for deliverable: ${deliverable.type}`);
                    results.alreadyExists++;
                    results.details.push({
                        client: client.name || client.companyName,
                        deliverable: deliverable.type,
                        status: "already_exists",
                        recurringTaskId: existingRecurring.id,
                    });
                    continue;
                }

                // Find the most recent task for this deliverable to use as template
                const templateTask = await prisma.task.findFirst({
                    where: {
                        clientId: client.id,
                        monthlyDeliverableId: deliverable.id,
                    },
                    orderBy: { createdAt: "desc" },
                });

                if (!templateTask) {
                    console.log(`   ⚠️  No existing task found for deliverable: ${deliverable.type}`);
                    results.noTemplateFound++;
                    results.details.push({
                        client: client.name || client.companyName,
                        deliverable: deliverable.type,
                        status: "no_template",
                        message: "No existing task to use as template - create first task manually",
                    });
                    continue;
                }

                console.log(`   📝 Found template task: ${templateTask.title || templateTask.id}`);

                if (!dryRun) {
                    // Create the RecurringTask entry
                    const newRecurring = await prisma.recurringTask.create({
                        data: {
                            clientId: client.id,
                            deliverableId: deliverable.id,
                            templateTaskId: templateTask.id,
                            active: true,
                            nextRunDate: getNextMonthFirstDay(),
                        },
                    });

                    console.log(`   ✅ Created RecurringTask: ${newRecurring.id}`);
                    results.details.push({
                        client: client.name || client.companyName,
                        deliverable: deliverable.type,
                        status: "created",
                        recurringTaskId: newRecurring.id,
                        templateTaskId: templateTask.id,
                        templateTaskTitle: templateTask.title,
                    });
                } else {
                    console.log(`   🔍 Would create RecurringTask for: ${deliverable.type}`);
                    results.details.push({
                        client: client.name || client.companyName,
                        deliverable: deliverable.type,
                        status: "would_create",
                        templateTaskId: templateTask.id,
                        templateTaskTitle: templateTask.title,
                    });
                }

                results.recurringTasksCreated++;
            }

            results.clientsProcessed++;
        }

        console.log(`\n🎉 Migration ${dryRun ? "preview" : ""} complete!`);
        console.log(`   Clients processed: ${results.clientsProcessed}`);
        console.log(`   RecurringTasks ${dryRun ? "would be " : ""}created: ${results.recurringTasksCreated}`);
        console.log(`   Already existed: ${results.alreadyExists}`);
        console.log(`   No template found: ${results.noTemplateFound}`);

        return NextResponse.json({
            success: true,
            dryRun,
            message: dryRun
                ? "Dry run complete - no changes made. Review details and run without dryRun=true to apply."
                : "Migration complete! RecurringTask entries have been created.",
            summary: {
                clientsProcessed: results.clientsProcessed,
                recurringTasksCreated: results.recurringTasksCreated,
                alreadyExisted: results.alreadyExists,
                noTemplateFound: results.noTemplateFound,
            },
            details: results.details,
        });
    } catch (err) {
        console.error("❌ Migration error:", err);
        return NextResponse.json(
            { success: false, message: "Migration failed", error: String(err) },
            { status: 500 }
        );
    }
}

// Helper: Get the first day of next month
function getNextMonthFirstDay(): Date {
    const now = new Date();
    const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    return new Date(nextYear, nextMonth, 1);
}

// GET: Show current RecurringTask status
export async function GET() {
    try {
        const recurringTasks = await prisma.recurringTask.findMany({
            include: {
                client: { select: { id: true, name: true, companyName: true } },
                deliverable: { select: { id: true, type: true, quantity: true } },
                templateTask: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const clients = await prisma.client.findMany({
            where: { status: "ACTIVE" },
            include: {
                monthlyDeliverables: true,
            },
        });

        const totalDeliverables = clients.reduce(
            (sum, c) => sum + c.monthlyDeliverables.length,
            0
        );

        return NextResponse.json({
            success: true,
            summary: {
                totalActiveClients: clients.length,
                totalDeliverables: totalDeliverables,
                recurringTasksConfigured: recurringTasks.length,
                needsSetup: totalDeliverables - recurringTasks.length,
            },
            recurringTasks: recurringTasks.map((rt) => ({
                id: rt.id,
                client: rt.client.name || rt.client.companyName,
                deliverable: rt.deliverable?.type,
                templateTask: rt.templateTask?.title,
                active: rt.active,
                nextRunDate: rt.nextRunDate,
                lastRunDate: rt.lastRunDate,
            })),
        });
    } catch (err) {
        console.error("❌ GET recurring status error:", err);
        return NextResponse.json(
            { success: false, message: "Failed to fetch status", error: String(err) },
            { status: 500 }
        );
    }
}
