import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const sessionToken = crypto.randomUUID();
    const userEmail = email || `guest_${sessionToken.slice(0, 8)}@sitwithme.app`;

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email: userEmail } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email: userEmail,
        name,
        provider: 'guest',
        sessionToken,
      },
    });

    // Create a Profile for the user
    const profile = await db.profile.create({
      data: {
        userId: user.id,
        displayName: name,
        avatar: '🧠',
      },
    });

    return NextResponse.json({ user, sessionToken, profile });
  } catch (error) {
    console.error('[signup] Error:', error);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
