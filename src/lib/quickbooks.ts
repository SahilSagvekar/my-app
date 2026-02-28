import OAuthClient from "intuit-oauth";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────
// OAuth Client
// ─────────────────────────────────────────

const QB_ENV =
    process.env.QUICKBOOKS_ENVIRONMENT === "production"
        ? "production"
        : "sandbox";

export function getOAuthClient() {
    return new OAuthClient({
        clientId: process.env.QUICKBOOKS_CLIENT_ID!,
        clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET!,
        environment: QB_ENV,
        redirectUri: process.env.QUICKBOOKS_REDIRECT_URI!,
    });
}

export function getAuthorizationUrl() {
    const client = getOAuthClient();
    return client.authorizeUri({
        scope: [OAuthClient.scopes.Accounting],
        state: "quickbooks-connect",
    });
}

// ─────────────────────────────────────────
// Token Management
// ─────────────────────────────────────────

export async function exchangeCodeForTokens(
    url: string,
    connectedBy: number
) {
    const client = getOAuthClient();
    const authResponse = await client.createToken(url);
    const token = authResponse.getJson();

    // Get company info
    let companyName: string | null = null;
    try {
        const companyInfo = await makeApiCallWithClient(
            client,
            token.realmId,
            "GET",
            `/v3/company/${token.realmId}/companyinfo/${token.realmId}`
        );
        companyName = companyInfo?.CompanyInfo?.CompanyName || null;
    } catch {
        // Company name is optional, proceed without it
    }

    // Upsert the connection (one connection per realmId)
    await prisma.quickBooksConnection.upsert({
        where: { realmId: token.realmId },
        update: {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            tokenExpiry: new Date(
                Date.now() + (token.expires_in || 3600) * 1000
            ),
            companyName,
            isActive: true,
            connectedBy,
        },
        create: {
            realmId: token.realmId,
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            tokenExpiry: new Date(
                Date.now() + (token.expires_in || 3600) * 1000
            ),
            companyName,
            isActive: true,
            connectedBy,
        },
    });

    return { realmId: token.realmId, companyName };
}

export async function getActiveConnection() {
    return prisma.quickBooksConnection.findFirst({
        where: { isActive: true },
    });
}

export async function getValidToken(): Promise<{
    accessToken: string;
    realmId: string;
} | null> {
    const connection = await getActiveConnection();
    if (!connection) return null;

    // If token is still valid (with 5-min buffer)
    if (connection.tokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
        return {
            accessToken: connection.accessToken,
            realmId: connection.realmId,
        };
    }

    // Refresh the token
    try {
        const client = getOAuthClient();
        client.setToken({
            access_token: connection.accessToken,
            refresh_token: connection.refreshToken,
            token_type: "bearer",
            expires_in: 0,
            realmId: connection.realmId,
        });

        const authResponse = await client.refresh();
        const token = authResponse.getJson();

        await prisma.quickBooksConnection.update({
            where: { id: connection.id },
            data: {
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                tokenExpiry: new Date(
                    Date.now() + (token.expires_in || 3600) * 1000
                ),
            },
        });

        return {
            accessToken: token.access_token,
            realmId: connection.realmId,
        };
    } catch (err) {
        console.error("[QuickBooks] Token refresh failed:", err);

        // Mark connection as inactive if refresh fails
        await prisma.quickBooksConnection.update({
            where: { id: connection.id },
            data: { isActive: false },
        });

        return null;
    }
}

export async function disconnectQuickBooks() {
    const connection = await getActiveConnection();
    if (!connection) return;

    try {
        const client = getOAuthClient();
        client.setToken({
            access_token: connection.accessToken,
            refresh_token: connection.refreshToken,
            token_type: "bearer",
            expires_in: 0,
            realmId: connection.realmId,
        });
        await client.revoke({ token: connection.refreshToken });
    } catch {
        // Revocation is best-effort
    }

    await prisma.quickBooksConnection.update({
        where: { id: connection.id },
        data: { isActive: false },
    });
}

// ─────────────────────────────────────────
// QBO API Helpers
// ─────────────────────────────────────────

const QBO_BASE_URL =
    QB_ENV === "production"
        ? "https://quickbooks.api.intuit.com"
        : "https://sandbox-quickbooks.api.intuit.com";

async function makeApiCallWithClient(
    client: OAuthClient,
    realmId: string,
    method: string,
    path: string,
    body?: any
): Promise<any> {
    const url = `${QBO_BASE_URL}${path}`;

    const response = await client.makeApiCall({
        url,
        method,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    return JSON.parse(response.text());
}

export async function makeApiCall(
    method: string,
    path: string,
    body?: any
): Promise<any> {
    const tokenInfo = await getValidToken();
    if (!tokenInfo) throw new Error("QuickBooks is not connected");

    const client = getOAuthClient();
    client.setToken({
        access_token: tokenInfo.accessToken,
        refresh_token: "", // Not needed for API calls
        token_type: "bearer",
        expires_in: 3600,
        realmId: tokenInfo.realmId,
    });

    return makeApiCallWithClient(client, tokenInfo.realmId, method, path, body);
}

// ─────────────────────────────────────────
// Customer Management
// ─────────────────────────────────────────

export async function findOrCreateCustomer(client: {
    id: string;
    name: string;
    email: string;
    companyName?: string | null;
}): Promise<string> {
    const tokenInfo = await getValidToken();
    if (!tokenInfo) throw new Error("QuickBooks is not connected");

    const { realmId } = tokenInfo;
    const displayName =
        client.companyName || client.name || `Client-${client.id}`;

    // Search for existing customer
    try {
        const query = encodeURIComponent(
            `SELECT * FROM Customer WHERE DisplayName = '${displayName.replace(/'/g, "\\'")}'`
        );
        const result = await makeApiCall(
            "GET",
            `/v3/company/${realmId}/query?query=${query}`
        );

        const customers = result?.QueryResponse?.Customer;
        if (customers && customers.length > 0) {
            return customers[0].Id;
        }
    } catch {
        // If search fails, proceed to create
    }

    // Create new customer
    const newCustomer = await makeApiCall(
        "POST",
        `/v3/company/${realmId}/customer`,
        {
            DisplayName: displayName,
            PrimaryEmailAddr: { Address: client.email },
            CompanyName: client.companyName || undefined,
        }
    );

    return newCustomer.Customer.Id;
}

// ─────────────────────────────────────────
// Invoice Management
// ─────────────────────────────────────────

export async function createQBInvoice(invoice: {
    qbCustomerId: string;
    amount: number;
    description: string;
    dueDate?: Date | null;
}): Promise<{ Id: string; DocNumber: string }> {
    const tokenInfo = await getValidToken();
    if (!tokenInfo) throw new Error("QuickBooks is not connected");

    const { realmId } = tokenInfo;

    const invoiceData: any = {
        CustomerRef: { value: invoice.qbCustomerId },
        Line: [
            {
                Amount: invoice.amount,
                DetailType: "SalesItemLineDetail",
                Description: invoice.description,
                SalesItemLineDetail: {
                    UnitPrice: invoice.amount,
                    Qty: 1,
                },
            },
        ],
    };

    if (invoice.dueDate) {
        invoiceData.DueDate = invoice.dueDate.toISOString().split("T")[0];
    }

    const result = await makeApiCall(
        "POST",
        `/v3/company/${realmId}/invoice`,
        invoiceData
    );

    return {
        Id: result.Invoice.Id,
        DocNumber: result.Invoice.DocNumber,
    };
}

export async function sendQBInvoice(
    qbInvoiceId: string
): Promise<void> {
    const tokenInfo = await getValidToken();
    if (!tokenInfo) throw new Error("QuickBooks is not connected");

    const { realmId } = tokenInfo;

    await makeApiCall(
        "POST",
        `/v3/company/${realmId}/invoice/${qbInvoiceId}/send`
    );
}

export async function voidQBInvoice(
    qbInvoiceId: string
): Promise<void> {
    const tokenInfo = await getValidToken();
    if (!tokenInfo) throw new Error("QuickBooks is not connected");

    const { realmId } = tokenInfo;

    // First get current invoice to get SyncToken
    const current = await makeApiCall(
        "GET",
        `/v3/company/${realmId}/invoice/${qbInvoiceId}`
    );

    await makeApiCall(
        "POST",
        `/v3/company/${realmId}/invoice?operation=void`,
        {
            Id: qbInvoiceId,
            SyncToken: current.Invoice.SyncToken,
            sparse: true,
        }
    );
}
