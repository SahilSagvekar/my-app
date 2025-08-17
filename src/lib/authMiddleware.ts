import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

export const prisma = new PrismaClient();

export async function authMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles: string[]
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  // Decode token and get user info (example using JWT)
  //   const decoded: any = /* decode your JWT here */;
  //   if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
  let decoded: any;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET!); // verify and decode
    // decoded now contains the payload you set when creating the token, e.g., { id, email, role }
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !allowedRoles.includes(user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return user; // returns authenticated user
}
