import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { oldPassword, newPassword } = await request.json();

    const user = await prisma.user.findFirst({
      where: { email: session.user.email }
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { ok: false, message: 'User not found' },
        { status: 404 }
      );
    }

    // Verify old password
    const isValid = await verifyPassword(oldPassword, user.password);
    
    if (!isValid) {
      return NextResponse.json(
        { ok: false, message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Hash and update new password
    const hashedPassword = await hashPassword(newPassword);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

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