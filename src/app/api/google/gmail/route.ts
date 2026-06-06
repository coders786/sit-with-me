import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

function base64EncodeUrl(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, to, subject, message } = body;

    if (!sessionToken || !to || !subject || !message) {
      return NextResponse.json(
        { error: 'sessionToken, to, subject, and message are required' },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    if (!user.googleToken) {
      return NextResponse.json({ error: 'Google account not connected' }, { status: 400 });
    }

    // Build raw email in RFC 2822 format
    const fromEmail = user.googleEmail || 'me';
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: =?utf-8?B?${base64EncodeUrl(subject)}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      message,
    ];

    const rawEmail = emailLines.join('\r\n');
    const raw = base64EncodeUrl(rawEmail);

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[google/gmail] API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to send email', details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json({ ok: true, messageId: result.id });
  } catch (error) {
    console.error('[google/gmail] Error:', error);
    return NextResponse.json({ error: 'Failed to send nudge email' }, { status: 500 });
  }
}
