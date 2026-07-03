export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStructure } from '@/lib/file-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const role = searchParams.get('role') || 'admin';
    const userId = searchParams.get('userId') || '0';

    console.log('🔍 Drive structure request:', { clientId, role, userId });

    let prefix = '';

    if (role === 'client') {
      let clientRecord = null;

      if (clientId) {
        clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });
      } else if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: parseInt(userId) },
          select: {
            email: true,
            linkedClientId: true,
            linkedClient: { select: { companyName: true, name: true } },
          },
        });
        if (user?.linkedClient) {
          clientRecord = user.linkedClient;
        } else if (user?.email) {
          clientRecord = await prisma.client.findFirst({
            where: { email: user.email },
            select: { companyName: true, name: true },
          });
        }
        if (!clientRecord) {
          clientRecord = await prisma.client.findFirst({
            where: { userId: parseInt(userId) },
            select: { companyName: true, name: true },
          });
        }
      }

      if (!clientRecord) {
        return NextResponse.json({ error: 'Client not found', code: 'CLIENT_NOT_LINKED' }, { status: 404 });
      }
      const companyName = clientRecord.companyName || clientRecord.name;
      prefix = `${companyName}/`;

    } else if (role === 'admin' || role === 'manager' || role === 'scheduler') {
      // Admin/manager must pass a clientId — file server blocks empty-prefix scans
      if (clientId) {
        const clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
        }
      }
      // No clientId = prefix stays '' = file server returns empty root (show "select a client")

    } else if (role === 'editor') {
      const editorId = parseInt(userId);

      // If a specific clientId is passed (editor selected a client), use it directly
      if (clientId) {
        const clientRecord = await prisma.client.findUnique({
          where: { id: clientId },
          select: { companyName: true, name: true },
        });
        if (clientRecord) {
          prefix = `${clientRecord.companyName || clientRecord.name}/`;
        }
      } else {
        // Derive from assigned tasks/permissions
        const permissions = await prisma.editorClientPermission.findMany({
          where: { editorId },
          include: { client: { select: { companyName: true, name: true } } },
        });
        const permNames = permissions.map(p => p.client.companyName || p.client.name).filter(Boolean);
        const taskClients = await prisma.task.findMany({
          where: { assignedTo: editorId, clientId: { not: null } },
          select: { client: { select: { companyName: true, name: true } } },
          distinct: ['clientId'],
        });
        const taskNames = taskClients.map(t => t.client?.companyName || t.client?.name || '').filter(Boolean);
        const assigned = [...new Set([...permNames, ...taskNames])];
        // Only auto-scope if exactly one client — otherwise wait for selector
        prefix = assigned.length === 1 ? `${assigned[0]}/` : '';
      }
    }

    const tree = await getStructure(userId, role, prefix);
    return NextResponse.json(tree);

  } catch (error: any) {
    console.error('❌ Structure error:', error);
    return NextResponse.json({ error: 'Failed to fetch structure', details: error.message }, { status: 500 });
  }
}