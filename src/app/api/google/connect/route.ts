import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      sessionToken,
      accessToken,
      refreshToken,
      email,
      expiresAt,
      providerId,
    } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'sessionToken is required' },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session token' },
        { status: 401 }
      );
    }

    const updateData: Record<string, unknown> = {
      provider: 'google',
      calendarConnected: true,
      tasksConnected: true,
      gmailConnected: true,
    };

    if (accessToken) updateData.googleToken = accessToken;
    if (refreshToken) updateData.googleRefreshToken = refreshToken;
    if (email) updateData.googleEmail = email;
    if (providerId) updateData.providerId = providerId;
    if (expiresAt) {
      updateData.googleTokenExpiry = new Date(expiresAt * 1000);
    }

    await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[google/connect] Error:', error);
    return NextResponse.json(
      { error: 'Failed to store Google connection' },
      { status: 500 }
    );
  }
}
