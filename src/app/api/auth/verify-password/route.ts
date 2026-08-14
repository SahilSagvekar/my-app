export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/password';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { db, closeDb } = getDb();
  try {
    try {
        const user = await getCurrentUser2(request);

        if (!user) {
            return NextResponse.json(
                { verified: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { password } = await request.json();

        if (!password) {
            return NextResponse.json(
                { verified: false, message: 'Password is required' },
                { status: 400 }
            );
        }

        const [dbUser] = await db.select().from(userTable).where(eq(userTable.id, user.id)).limit(1);

        if (!dbUser || !dbUser.password) {
            return NextResponse.json(
                { verified: false, message: 'User not found' },
                { status: 404 }
            );
        }

        const isValid = await verifyPassword(password, dbUser.password);

        if (!isValid) {
            return NextResponse.json(
                { verified: false, message: 'Incorrect password. Please try again.' },
                { status: 400 }
            );
        }

        return NextResponse.json({ verified: true });

    } catch (error) {
        console.error('Verify password error:', error);
        return NextResponse.json(
            { verified: false, message: 'Failed to verify password' },
            { status: 500 }
        );
    }

  } finally {
    await closeDb();
  }
}
