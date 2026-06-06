import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

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

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        {
          role: 'system',
          content: `You are a learning session summarizer. Given a conversation between a student and their AI mentor, create a concise session summary. Respond ONLY in this exact JSON format, no other text:
{"summary": "2-3 sentence overview of what was covered", "keyPoints": ["point 1", "point 2", "point 3"]}`,
        },
        { role: 'user', content: `Summarize this learning session:\n\n${conversationText}` },
      ],
      temperature: 0.5,
    });

    const text = result?.choices?.[0]?.message?.content || result?.content || '{}';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: 'Session completed.', keyPoints: [] };
    } catch {
      parsed = { summary: 'Session completed.', keyPoints: [] };
    }

    return NextResponse.json({
      summary: parsed.summary || 'Session completed.',
      keyPoints: parsed.keyPoints || [],
    });
  } catch (error) {
    console.error('[ai/summary] Error:', error);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
