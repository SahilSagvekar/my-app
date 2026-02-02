// lib/auth.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from '@/lib/prisma';

export const verifyToken = (token: string) => {
  try {
    // const verified = jwt.verify(token, process.env.JWT_SECRET || "");
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("Verified Token:", verified);
    return verified as { userId: number; email: string; iat: number; exp: number };
  } catch {
    return null;
  }
};

// Async version if cookies() returns a Promise
export async function getUser(req: Request) {
  function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
  }

  const token = getTokenFromCookies(req);
  if (!token)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
  return decoded; // should contain id, email, role
}

export async function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
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

// export async function requireAdmin(req: NextRequest) {
//   console.log("requireAdmin called");
//   try {
//     // ✅ Get token from cookie instead of Authorization header
//     const token = req.cookies.get("authToken")?.value;
//     if (!token) return null;
//     console.log("JWT Token:", token);

//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//     console.log("Decoded JWT:", decoded);

//     const user = await prisma.user.findUnique({
//       where: { email: decoded.email },
//     });
//     console.log("User from DB:", user);

//     // Allow both admin and manager
//     if (!user || (user.role !== "admin" && user.role !== "manager")) {
//       return null;
//     }

//     return user; // return the user object
//   } catch (err) {
//     console.error("requireAdmin error:", err);
//     return null;
//   }
// }


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

import { auth } from "@/auth";

export async function getCurrentUser2(req?: NextRequest) {
  try {
    // 1. Try Custom JWT Token (Cookie or Header)
    const cookieToken = req
      ? req.cookies.get("authToken")?.value
      : (await cookies()).get("authToken")?.value;

    const headerToken = req?.headers.get("authorization")?.split(" ")[1];
    const token = cookieToken || headerToken;

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as Decoded;
        if (decoded?.userId) {
          const user = await prisma.user.findUnique({ where: { id: Number(decoded.userId) } });
          if (user) return user;
        }
      } catch (jwtErr) {
        // Fall through to NextAuth
      }
    }

    // 2. Try NextAuth Session (Google/Slack)
    const session = await auth();
    if (session?.user?.email) {
      const user = await prisma.user.findFirst({
        where: { email: session.user.email }
      });
      if (user) return user;
    }

    return null;
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
    // const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded; // must contain userId inside it
  } catch (e) {
    return null;
  }
}

export async function requireAdmin(req: NextRequest) {
  // stub: replace with your real session lookup
  // e.g., getToken(req) or getServerSession()
  function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
  }

  const token = getTokenFromCookies(req);
  if (!token)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
  const { role, userId } = decoded;

  // const userId = Number(req.headers.get('x-user-id')); // temporary: client must send this
  // if (!userId) throw { status: 401, message: 'Unauthorized' };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "admin" && user.role !== "manager")
    throw { status: 403, message: "Admin required" };
  return user;
}

export async function getRequestingUser(req: NextRequest) {
  const userId = Number(req.headers.get('x-user-id'));
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

export function isEmployee(user: { role: string } | null) {
  if (!user) return false;
  return user.role !== 'admin' && user.role !== 'client';
}


