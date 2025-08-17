// lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const prisma = new PrismaClient();

// export async function requireAdmin(req: NextRequest) {
//   try{
//   const authHeader = req.headers.get('authorization');
//   const token = authHeader?.split(' ')[1];  
//   if (!token) return null;
//   // Mock token validation for now (replace with real JWT verification)
//   const user = await prisma.user.findUnique({ where: { id: Number(token) } });

//   if (!user || user.role !== 'admin') return null;

//   return user;
// } catch (err) {
//     console.error('requireAdmin error:', err);
//     return null;
//   }
// }

export async function requireAdmin(req: NextRequest) {
  console.log("requireAdmin called");
  try {
    // ✅ Get token from cookie instead of Authorization header
    const token = req.cookies.get("authToken")?.value;
    if (!token) return null;
    console.log("JWT Token:", token);

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    console.log("Decoded JWT:", decoded);

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
    });
    console.log("User from DB:", user);

    // Allow both admin and manager
    if (!user || (user.role !== "admin" && user.role !== "manager")) {
      return null;
    }

    return user; // return the user object
  } catch (err) {
    console.error("requireAdmin error:", err);
    return null;
  }
}


export async function getCurrentUser(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.split(" ")[1];
    if (!token) return null;

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded; // should contain id, email, role
  } catch {
    return null;
  }
}
