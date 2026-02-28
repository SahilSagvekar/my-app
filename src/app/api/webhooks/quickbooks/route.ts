import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// POST /api/webhooks/quickbooks — Handle QBO webhook events
export async function POST(req: NextRequest) {
    const body = await req.text();

    // Verify webhook signature if QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN is set
    const verifierToken = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;
    if (verifierToken) {
        const signature = req.headers.get("intuit-signature");
        if (!signature) {
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }

        const hash = crypto
            .createHmac("sha256", verifierToken)
            .update(body)
            .digest("base64");

        if (hash !== signature) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
    }

    try {
        const payload = JSON.parse(body);
        const notifications =
            payload.eventNotifications || [];

        for (const notification of notifications) {
            const realmId = notification.realmId;
            const entities = notification.dataChangeEvent?.entities || [];

            for (const entity of entities) {
                if (entity.name === "Invoice") {
                    await handleInvoiceEvent(entity, realmId);
                } else if (entity.name === "Payment") {
                    await handlePaymentEvent(entity, realmId);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[QBO Webhook] Error:", err);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}

async function handleInvoiceEvent(entity: any, realmId: string) {
    const qbInvoiceId = entity.id;
    const operation = entity.operation;

    if (operation === "Void") {
        await prisma.invoice.updateMany({
            where: { qbInvoiceId: String(qbInvoiceId) },
            data: { status: "VOIDED" },
        });
    }
}

async function handlePaymentEvent(entity: any, realmId: string) {
    // When a payment is received in QBO, we try to update the related invoice
    // The payment entity doesn't directly reference invoice ID in the webhook,
    // so we may need to query QBO for details. For now, log it.
    console.log(
        `[QBO Webhook] Payment ${entity.operation} for realmId ${realmId}:`,
        entity.id
    );
}

// GET handler for webhook verification (Intuit sends a GET to verify the endpoint)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const challenge = searchParams.get("challenge");

    if (challenge) {
        return new NextResponse(challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
        });
    }

    return NextResponse.json({ status: "ok" });
}
