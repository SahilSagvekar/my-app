"use server";

import { prisma } from "../../lib/prisma";
import { auth } from "../../auth";

export interface SearchResult {
  id: string;
  type: 'page' | 'task' | 'project' | 'user' | 'client' | 'report';
  title: string;
  description: string;
  url: string;
  category: string;
  priority?: 'high' | 'medium' | 'low';
  status?: string;
  date?: string;
}

/**
 * Global Search Server Action
 * 
 * Performs a unified search across Tasks, Clients, and Users.
 * Results are filtered based on the current user's role and identity.
 */
export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const session = await auth();
  if (!session?.user || !query.trim()) return [];

  const role = (session.user as any).role?.toLowerCase() || 'client';
  const userId = parseInt(session.user.id!);
  const q = query.trim();

  const results: SearchResult[] = [];

  try {
    // 1. Search Tasks (Available for all roles, but visibility restricted)
    const taskWhere: any = {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ]
    };

    // Role-based visibility for tasks
    if (role === 'client') {
      taskWhere.clientUserId = userId;
    } else if (role !== 'admin' && role !== 'manager') {
      taskWhere.assignedTo = userId;
    }

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    results.push(...tasks.map(t => ({
      id: t.id,
      type: 'task' as const,
      title: t.title || 'Untitled Task',
      description: t.description,
      url: `/${role}/my-tasks`,
      category: 'Tasks',
      status: t.status || undefined,
      priority: (t.priority?.toLowerCase() as any) || undefined
    })));

    // 2. Search Clients (Admin/Manager/Sales only)
    if (['admin', 'manager', 'sales', 'scheduler'].includes(role)) {
      const clients = await prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { companyName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]
        },
        take: 5
      });

      results.push(...clients.map(c => ({
        id: c.id,
        type: 'client' as const,
        title: c.name,
        description: c.companyName || c.email,
        url: `/${role}/clients`,
        category: 'Clients',
        status: (c.status as any)
      })));
    }

    // 3. Search Users (Admin/Manager only)
    if (['admin', 'manager'].includes(role)) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]
        },
        take: 5
      });

      results.push(...users.map(u => ({
        id: u.id.toString(),
        type: 'user' as const,
        title: u.name || 'Unknown User',
        description: u.email,
        url: `/${role}/users`,
        category: 'Team'
      })));
    }

  } catch (error) {
    console.error("[SearchAction] Global search failed:", error);
    return [];
  }

  // Final relevance sort and limit
  return results
    .sort((a, b) => {
      const aLower = a.title.toLowerCase();
      const bLower = b.title.toLowerCase();
      const qLower = q.toLowerCase();
      
      if (aLower.startsWith(qLower) && !bLower.startsWith(qLower)) return -1;
      if (!aLower.startsWith(qLower) && bLower.startsWith(qLower)) return 1;
      return 0;
    })
    .slice(0, 10);
}
