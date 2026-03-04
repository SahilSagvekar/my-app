export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { getCurrentUser2 } from '@/lib/auth';

export async function POST(request: NextRequest) {
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

        const dbUser = await prisma.user.findFirst({
            where: { id: user.id }
        });

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
}
