// lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const prisma = new PrismaClient();

export const verifyToken = (token: string) => {
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET || "secret");
    // console.log("Verified Token:", verified);
    return verified as { userId: number; email: string; iat: number; exp: number };
  } catch { 
    return null;
  }
};

// Async version if cookies() returns a Promise
export async function getUser() {
  const cookieStore = await cookies(); // Add await
  const authCookie = cookieStore.get("authToken");
  // console.log("Auth Cookie:", authCookie);
  const token = authCookie?.value;
  // console.log("token:", token);

  if (!token) return null;

  return verifyToken(token);
}

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

type Decoded = { userId: string; email: string; role?: string; name?: string };

export async function getCurrentUser2(req?: NextRequest) {
  try {
    // Prefer cookie; allow Authorization header for Postman
    const cookieToken = req
      ? req.cookies.get("authToken")?.value
      : cookies().get("authToken")?.value;

      // console.log(req.cookies.getAll());
      // console.log(req.headers.get("cookie"))

    const headerToken = req?.headers.get("authorization")?.split(" ")[1];

    const token = cookieToken || headerToken;
   
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret") as Decoded;
    // console.log("getCurrentUser2 decoded:", decoded);
    if (!decoded?.userId) return null;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    // console.log("getCurrentUser2 user:", user);
    if (!user) return null;

    return user;

    // return { userId: user.id, email: user.email, role: user.role, name: user.name };
  } catch (err) {
    console.error("getCurrentUser error:", err);
    return null;
  }
}

export function getUserFromRequest(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  if (!match) return null;

  const token = match[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    return decoded; // must contain userId inside it
  } catch (e) {
    return null;
  }
}
