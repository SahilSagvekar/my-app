// lib/auth-helpers.ts
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface JWTUser {
  userId: number;
  id: number;
  email: string;
  role: string;
  roles?: string[];
  name?: string;
}

// True if the user's primary role OR their additional roles[] match.
// Use this instead of `user.role === 'x'` anywhere a multi-role account
// (e.g. someone who's editor + scheduler + qc) needs to pass a role gate.
export function hasRole(user: JWTUser | null, role: string): boolean {
  if (!user) return false;
  if (user.role === role) return true;
  return Array.isArray(user.roles) && user.roles.includes(role);
}

export function getUserFromToken(req: NextRequest): JWTUser | null {
  try {
    // Cookie first (browser sessions), then Authorization: Bearer header
    // (desktop app / any non-browser client that can't hold cookies).
    const cookieToken = req.cookies.get('authToken')?.value;
    const headerToken = req.headers.get('authorization')?.split(' ')[1];
    const token = cookieToken || headerToken;

    if (!token) {
      return null;
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function requireAdmin(user: JWTUser | null) {
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  if (user.role !== 'ADMIN' && user.role !== 'admin') {
    return { error: 'Access denied. Admin only.', status: 403 };
  }
  
  return null;
}