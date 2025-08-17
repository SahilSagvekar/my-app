// pages/api/admin/users.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../../../lib/auth';

const prisma = new PrismaClient();

// Map task types to roles that can be assigned
const taskTypeRoleMap: Record<string, string[]> = {
  'quality_review': ['qc', 'qc_specialist'],
  'video_editing': ['editor', 'videographer'],
  'general_task': ['editor', 'videographer', 'qc_specialist'],
  // Add more task types as needed
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const user = await requireAdmin(req, res);
  if (!user) return;

  const { taskType } = req.query;

  if (!taskType || typeof taskType !== 'string') {
    return res.status(400).json({ message: 'taskType is required' });
  }

  const allowedRoles = taskTypeRoleMap[taskType];
  if (!allowedRoles) {
    return res.status(400).json({ message: 'Invalid task type' });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: allowedRoles },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
}
