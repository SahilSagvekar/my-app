// lib/auth.ts
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from '@/lib/prisma';
import { auth } from "@/auth";

type DecodedToken = jwt.JwtPayload & {
  userId?: number | string;
  id?: number | string;
  email?: string;
  role?: string;
  name?: string;
};

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

  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    return decoded; // should contain id, email, role
  } catch {
    return null;
  }
}

export async function getCurrentUser2(req?: NextRequest) {
  try {
    const cookieTokenFromHeader = req
      ? await getTokenFromCookies(req as unknown as Request)
      : null;

    // 1. Try Custom JWT Token (Cookie or Header)
    const cookieToken = req
      ? "cookies" in req && req.cookies
        ? req.cookies.get("authToken")?.value
        : cookieTokenFromHeader
      : (await cookies()).get("authToken")?.value;

    const headerToken = req?.headers.get("authorization")?.split(" ")[1];
    const token = cookieToken || headerToken;

    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as DecodedToken;
        // Support both custom 'userId' and NextAuth's 'id' field
        const effectiveId = decoded?.userId || decoded?.id;

        if (effectiveId) {
          const user = await prisma.user.findUnique({ where: { id: Number(effectiveId) } });
          if (user) return user;
        }
      } catch {
        // Fall through to NextAuth
      }
    }

    // 2. Try NextAuth Session (Google/Slack)
    const session = await auth();
    if (session?.user?.email) {
      const user = await prisma.user.findFirst({
        where: { email: session.user.email }
      });
      if (user && (user.employeeStatus === 'ACTIVE' || user.email === 'sahilsagvekar230@gmail.com')) return user;
    }

    return null;
  } catch (error) {
    console.error("getCurrentUser error:", error);
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
  } catch {
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

  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
  const userId = decoded.userId;

  // const userId = Number(req.headers.get('x-user-id')); // temporary: client must send this
  // if (!userId) throw { status: 401, message: 'Unauthorized' };

  const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
  if (!user || (user.employeeStatus !== 'ACTIVE' && user.email !== 'sahilsagvekar230@gmail.com'))
    throw { status: 403, message: "Account deactivated" };

  if (user.role !== "admin" && user.role !== "manager")
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

/**
 * Resolves the Client ID for a given user.
 * 
 * Strategy (with backward compatibility):
 *   1. Check user.linkedClientId (new multi-user method)
 *   2. Fallback: Check Client.userId (old 1:1 method)
 * 
 * This ensures ALL users linked to the same client resolve to the same clientId,
 * regardless of which linking method was used.
 */
export async function resolveClientIdForUser(userId: number): Promise<string | null> {
  // Method 1: Check linkedClientId on the User record (preferred, supports multi-user)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linkedClientId: true },
  });

  if (user?.linkedClientId) {
    return user.linkedClientId;
  }

  // Method 2: Fallback to old Client.userId (1:1 relation, backward compat)
  const clientByUserId = await prisma.client.findFirst({
    where: { userId: userId },
    select: { id: true },
  });

  return clientByUserId?.id || null;
}
