import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: List recent room messages (last 80)
export async function GET() {
  try {
    const messages = await db.roomMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    // Return in chronological order (oldest first)
    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('[room GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch room messages' }, { status: 500 });
  }
}

// POST: Post a message to the room
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, text } = body;

    if (!sessionToken || !text) {
      return NextResponse.json({ error: 'sessionToken and text are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({
      where: { sessionToken },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const profile = user.profile;

    const message = await db.roomMessage.create({
      data: {
        userId: user.id,
        name: profile?.displayName || user.name || 'Anonymous',
        avatar: profile?.avatar || '🙂',
        text,
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('[room POST] Error:', error);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}
