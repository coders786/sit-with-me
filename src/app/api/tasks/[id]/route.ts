import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH: Update task (e.g., mark as completed)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { sessionToken, status } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Verify task belongs to user
    const existingTask = await db.task.findUnique({ where: { id } });
    if (!existingTask || existingTask.userId !== user.id) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) {
      updateData.status = status;
      // Set completedAt when marking as completed
      if (status === 'completed') {
        updateData.completedAt = new Date();
        // Increment wins for completing a task
        await db.user.update({
          where: { id: user.id },
          data: {
            wins: { increment: 1 },
            successStreak: { increment: 1 },
            bestStreak: user.bestStreak < user.successStreak + 1 ? user.successStreak + 1 : user.bestStreak,
            xp: { increment: 25 },
          },
        });
      } else if (status === 'pending') {
        updateData.completedAt = null;
      }
    }

    const task = await db.task.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ task });
  } catch (error) {
    console.error('[tasks/[id] PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}
