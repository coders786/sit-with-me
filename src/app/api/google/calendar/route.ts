import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    if (!user.googleToken) {
      return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    switch (action) {
      case 'list': {
        const timeMin = params.timeMin || new Date().toISOString();
        const timeMax = params.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const maxResults = params.maxResults || 20;

        const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        calendarUrl.searchParams.set('timeMin', timeMin);
        calendarUrl.searchParams.set('timeMax', timeMax);
        calendarUrl.searchParams.set('maxResults', String(maxResults));
        calendarUrl.searchParams.set('orderBy', 'startTime');
        calendarUrl.searchParams.set('singleEvents', 'true');

        const response = await fetch(calendarUrl.toString(), {
          headers: {
            Authorization: `Bearer ${user.googleToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[google/calendar] API error:', errorData);
          return NextResponse.json(
            { error: 'Google Calendar API error', details: errorData },
            { status: response.status }
          );
        }

        const data = await response.json();
        return NextResponse.json({ events: data.items || [] });
      }

      case 'create': {
        const { summary, description, start, end } = params;

        if (!summary || !start || !end) {
          return NextResponse.json(
            { error: 'summary, start, and end are required for create action' },
            { status: 400 }
          );
        }

        const response = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${user.googleToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              summary,
              description: description || '',
              start: {
                dateTime: start,
                timeZone: params.timeZone || 'UTC',
              },
              end: {
                dateTime: end,
                timeZone: params.timeZone || 'UTC',
              },
              reminders: {
                useDefault: true,
              },
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[google/calendar] Create error:', errorData);
          return NextResponse.json(
            { error: 'Failed to create calendar event', details: errorData },
            { status: response.status }
          );
        }

        const event = await response.json();
        return NextResponse.json({ event });
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use "list" or "create"' }, { status: 400 });
    }
  } catch (error) {
    console.error('[google/calendar] Error:', error);
    return NextResponse.json({ error: 'Calendar operation failed' }, { status: 500 });
  }
}
