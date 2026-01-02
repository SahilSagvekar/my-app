// src/app/api/health/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('[Health Check] DB connection failed:', error.message);
    return NextResponse.json({ status: 'error', db: error.message }, { status: 500 });
  }
}