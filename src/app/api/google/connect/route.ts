import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, googleToken, googleEmail } = body;

    if (!sessionToken || !googleToken || !googleEmail) {
      return NextResponse.json({ error: 'sessionToken, googleToken, and googleEmail are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        googleToken,
        googleEmail,
        provider: 'google',
        calendarConnected: true,
        tasksConnected: true,
        gmailConnected: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[google/connect] Error:', error);
    return NextResponse.json({ error: 'Failed to store Google connection' }, { status: 500 });
  }
}
