import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getValidGoogleToken } from '@/lib/google-auth';

function base64EncodeUrl(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(str: string): string {
  // Gmail API returns URL-safe base64
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, action, ...params } = body;

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

    const accessToken = await getValidGoogleToken(user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Google token expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }

    const gmailAction = action || 'send';

    switch (gmailAction) {
      case 'send': {
        const { to, subject, message } = params;
        if (!to || !subject || !message) {
          return NextResponse.json(
            { error: 'to, subject, and message are required for send action' },
            { status: 400 }
          );
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
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('[google/gmail] Send error:', errorData);
          return NextResponse.json(
            { error: 'Failed to send email', details: errorData },
            { status: response.status }
          );
        }

        const result = await response.json();
        return NextResponse.json({ ok: true, messageId: result.id });
      }

      case 'read': {
        const maxResults = params.maxResults || 10;
        const query = params.query || '';

        // List recent messages
        const listUrl = new URL(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages'
        );
        listUrl.searchParams.set('maxResults', String(maxResults));
        if (query) listUrl.searchParams.set('q', query);

        const listResponse = await fetch(listUrl.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!listResponse.ok) {
          const errorData = await listResponse.json().catch(() => ({}));
          console.error('[google/gmail] List error:', errorData);
          return NextResponse.json(
            { error: 'Failed to list emails', details: errorData },
            { status: listResponse.status }
          );
        }

        const listData = await listResponse.json();
        const messageIds = (listData.messages || []).map(
          (m: { id: string; threadId: string }) => m.id
        );

        // Fetch each message's details (subject, from, snippet)
        const emails = [];
        for (const msgId of messageIds.slice(0, maxResults)) {
          try {
            const msgResponse = await fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (msgResponse.ok) {
              const msgData = await msgResponse.json();
              const headers = msgData.payload?.headers || [];
              const subject =
                headers.find(
                  (h: { name: string; value: string }) =>
                    h.name === 'Subject'
                )?.value || '(No Subject)';
              const from =
                headers.find(
                  (h: { name: string; value: string }) =>
                    h.name === 'From'
                )?.value || '';
              const date =
                headers.find(
                  (h: { name: string; value: string }) =>
                    h.name === 'Date'
                )?.value || '';

              emails.push({
                id: msgData.id,
                threadId: msgData.threadId,
                subject,
                from,
                date,
                snippet: msgData.snippet || '',
                labelIds: msgData.labelIds || [],
              });
            }
          } catch {
            // Skip individual message errors
          }
        }

        return NextResponse.json({
          emails,
          resultSizeEstimate: listData.resultSizeEstimate || 0,
        });
      }

      case 'get': {
        const { messageId } = params;
        if (!messageId) {
          return NextResponse.json(
            { error: 'messageId is required for get action' },
            { status: 400 }
          );
        }

        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!msgResponse.ok) {
          const errorData = await msgResponse.json().catch(() => ({}));
          console.error('[google/gmail] Get error:', errorData);
          return NextResponse.json(
            { error: 'Failed to get email', details: errorData },
            { status: msgResponse.status }
          );
        }

        const msgData = await msgResponse.json();
        const headers = msgData.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find(
            (h: { name: string; value: string }) => h.name === name
          )?.value || '';

        // Try to extract text body
        let textBody = '';
        const htmlBody = '';

        function extractBody(
          payload: {
            mimeType?: string;
            body?: { data?: string };
            parts?: unknown[];
          },
          isHtml = false
        ): string {
          if (
            payload.mimeType === 'text/plain' &&
            payload.body?.data
          ) {
            return decodeBase64Url(payload.body.data);
          }
          if (
            payload.mimeType === 'text/html' &&
            payload.body?.data &&
            isHtml
          ) {
            return decodeBase64Url(payload.body.data);
          }
          if (payload.parts) {
            for (const part of payload.parts) {
              const result = extractBody(
                part as {
                  mimeType?: string;
                  body?: { data?: string };
                  parts?: unknown[];
                },
                isHtml
              );
              if (result) return result;
            }
          }
          return '';
        }

        textBody = extractBody(msgData.payload);

        return NextResponse.json({
          id: msgData.id,
          threadId: msgData.threadId,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          snippet: msgData.snippet || '',
          textBody,
          htmlBody,
          labelIds: msgData.labelIds || [],
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "send", "read", or "get"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[google/gmail] Error:', error);
    return NextResponse.json(
      { error: 'Gmail operation failed' },
      { status: 500 }
    );
  }
}
