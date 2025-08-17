import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const taskTypeRoleMap: Record<string, string[]> = {
  quality_review: ["qc", "qc_specialist"],
  video_editing: ["editor", "videographer"],
  management: ["admin", "manager"],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { taskType } = req.query;

  if (!taskType || typeof taskType !== "string") {
    return res.status(400).json({ error: "taskType is required" });
  }

  try {
    const allowedRoles = taskTypeRoleMap[taskType] || [];

    // Fetch users with these roles
    const roleUsers = await prisma.user.findMany({
      where: { role: { in: allowedRoles } },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.status(200).json({ allowedRoles, roleUsers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
