// lib/auth-helpers.ts
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface JWTUser {
  userId: number;
  id: number;
  email: string;
  role: string;
  name?: string;
}

export function getUserFromToken(req: NextRequest): JWTUser | null {
  try {
    const token = req.cookies.get('authToken')?.value;
    
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