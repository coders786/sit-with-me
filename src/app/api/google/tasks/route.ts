import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getValidGoogleToken } from '@/lib/google-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, action, ...params } = body;

    if (!sessionToken || !action) {
      return NextResponse.json({ error: 'sessionToken and action are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const accessToken = await getValidGoogleToken(user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google token expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }

    switch (action) {
      case 'list': {
        const tasklist = params.tasklist || '@default';
        const showCompleted = params.showCompleted || false;
        const maxResults = params.maxResults || 50;

        const tasksUrl = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${tasklist}/tasks`);
        tasksUrl.searchParams.set('showCompleted', String(showCompleted));
        tasksUrl.searchParams.set('maxResults', String(maxResults));

        const response = await fetch(tasksUrl.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[google/tasks] API error:', errorData);
          return NextResponse.json(
            { error: 'Google Tasks API error', details: errorData },
            { status: response.status }
          );
        }

        const data = await response.json();

        // Sync Google tasks to local database
        const googleTasks = data.items || [];
        for (const gTask of googleTasks) {
          // Check if we already have this task locally
          const existing = await db.task.findFirst({
            where: { userId: user.id, googleTaskId: gTask.id },
          });

          if (!existing) {
            await db.task.create({
              data: {
                userId: user.id,
                title: gTask.title || 'Untitled task',
                notes: gTask.notes || null,
                due: gTask.due || null,
                status: gTask.status === 'completed' ? 'completed' : 'pending',
                source: 'google',
                googleTaskId: gTask.id,
                completedAt: gTask.completed ? new Date(gTask.completed) : null,
              },
            });
          }
        }

        return NextResponse.json({ tasks: googleTasks });
      }

      case 'create': {
        const { title, notes, due, tasklist } = params;

        if (!title) {
          return NextResponse.json(
            { error: 'title is required for create action' },
            { status: 400 }
          );
        }

        const taskListId = tasklist || '@default';

        const requestBody: Record<string, unknown> = { title };
        if (notes) requestBody.notes = notes;
        if (due) requestBody.due = due;

        const response = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[google/tasks] Create error:', errorData);
          return NextResponse.json(
            { error: 'Failed to create Google task', details: errorData },
            { status: response.status }
          );
        }

        const gTask = await response.json();

        // Also create locally
        await db.task.create({
          data: {
            userId: user.id,
            title: gTask.title || title,
            notes: notes || null,
            due: due || null,
            status: 'pending',
            source: 'google',
            googleTaskId: gTask.id,
          },
        });

        return NextResponse.json({ task: gTask });
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use "list" or "create"' }, { status: 400 });
    }
  } catch (error) {
    console.error('[google/tasks] Error:', error);
    return NextResponse.json({ error: 'Tasks operation failed' }, { status: 500 });
  }
}
