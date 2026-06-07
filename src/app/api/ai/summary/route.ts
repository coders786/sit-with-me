import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatCompletion } from '@/lib/ai-sdk';
import { buildSystemPrompt } from '@/lib/ai-personality';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, messages } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'sessionToken is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages to summarize' }, { status: 400 });
    }

    const conversationText = messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n');

    const systemPrompt = buildSystemPrompt({
      tone: 'summary',
      additionalRules: [
        `Summarize this learning session. Return ONLY JSON, no other text:`,
        `{"summary": "2-3 sentences about what went down — write it like you're telling a friend who missed the session", "keyPoints": ["the main takeaways, written like you'd actually say them"]}`,
        ``,
        `The summary should capture the vibe and the substance. The key points should be things worth remembering, not generic observations.`,
      ],
    });

    const text = await chatCompletion({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here's the session — what happened?\n\n${conversationText}` },
      ],
      temperature: 0.5,
    }) || '{}';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: 'Session wrapped up.', keyPoints: [] };
    } catch {
      parsed = { summary: 'Session wrapped up.', keyPoints: [] };
    }

    return NextResponse.json({
      summary: parsed.summary || 'Session wrapped up.',
      keyPoints: parsed.keyPoints || [],
    });
  } catch (error) {
    console.error('[ai/summary] Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
