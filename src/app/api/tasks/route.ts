import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET: List user's tasks
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionToken = searchParams.get('sessionToken');

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const tasks = await db.task.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[tasks GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST: Create a task
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, title, notes, due, source } = body;

    if (!sessionToken || !title) {
      return NextResponse.json({ error: 'sessionToken and title are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const task = await db.task.create({
      data: {
        userId: user.id,
        title,
        notes: notes || null,
        due: due || null,
        source: source || 'local',
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[tasks POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
