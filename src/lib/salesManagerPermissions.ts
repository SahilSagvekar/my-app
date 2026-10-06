// src/lib/salesManagerPermissions.ts
// Resolves which sales rep userIds a sales_manager is permitted to see.
// Mirrors the EditorClientPermission pattern used for editor -> client scoping.

import { getDbHttp } from '@/lib/db';
import { salesManagerPermission } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Returns the manager's own id plus every sales rep id an admin has granted them.
export async function getVisibleSalesRepIds(managerId: number): Promise<number[]> {
    const permissions = await getDbHttp()
        .select({ salesRepId: salesManagerPermission.salesRepId })
        .from(salesManagerPermission)
        .where(eq(salesManagerPermission.managerId, managerId));

    const ids = new Set<number>([managerId]);
    for (const p of permissions) ids.add(p.salesRepId);
    return Array.from(ids);
}
