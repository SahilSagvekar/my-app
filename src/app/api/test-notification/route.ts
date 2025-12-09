import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/lib/notificationService';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    console.log("decoded" + decoded);
    const { userId } = decoded;

    console.log('Creating notification for userId:', userId); // ADD THIS

    await createNotification(
      userId,
      'test',
      'Test Notification',
      'This is a test notification!'
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in test-notification:', error); // ADD THIS
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}