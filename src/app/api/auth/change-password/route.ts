export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '@/lib/password';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();  // Use auth() instead of getServerSession()
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { oldPassword, newPassword } = await request.json();

    const [foundUser] = await db.select().from(user).where(eq(user.email, session.user.email)).limit(1);

    if (!foundUser || !foundUser.password) {
      return NextResponse.json(
        { ok: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, foundUser.password);

    if (!isValid) {
      return NextResponse.json(
        { ok: false, message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);

    await db.update(user).set({
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    }).where(eq(user.id, foundUser.id));

    return NextResponse.json({
      ok: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { ok: false, message: 'Failed to change password' },
      { status: 500 }
    );
  }
}