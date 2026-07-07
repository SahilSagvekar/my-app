// src/lib/salesManagerPermissions.ts
// Resolves which sales rep userIds a sales_manager is permitted to see.
// Mirrors the EditorClientPermission pattern used for editor -> client scoping.

import { prisma } from '@/lib/prisma';

// Returns the manager's own id plus every sales rep id an admin has granted them.
export async function getVisibleSalesRepIds(managerId: number): Promise<number[]> {
    const permissions = await (prisma as any).salesManagerPermission.findMany({
        where: { managerId },
        select: { salesRepId: true },
    });

    const ids = new Set<number>([managerId]);
    for (const p of permissions) ids.add(p.salesRepId);
    return Array.from(ids);
}
