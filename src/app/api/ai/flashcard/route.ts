import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatCompletion, MODELS } from '@/lib/ai-sdk';
import { buildSystemPrompt } from '@/lib/ai-personality';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, content } = body;

    if (!sessionToken || !content) {
      return NextResponse.json({ error: 'sessionToken and content are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const systemPrompt = buildSystemPrompt({
      tone: 'flashcard',
      additionalRules: [
        `Pull out 1-3 key concepts from this content and make flashcards. Return ONLY a JSON array, no other text:`,
        `[{"front": "a question someone would actually ask (not a textbook definition)", "back": "the answer explained like you're talking to a friend"}]`,
        ``,
        `The "front" should be a real question, not "What is X?" — make it feel like someone's genuinely curious.`,
        `The "back" should explain it clearly and simply, like you're helping a friend understand. No jargon unless necessary.`,
      ],
    });

    const rawText = await chatCompletion({
      model: MODELS.FAST,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.slice(0, 2000) },
      ],
      temperature: 0.5,
    }) || '[]';

    // Parse the JSON array from the response
    let cards: Array<{ front: string; back: string }> = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cards = JSON.parse(jsonMatch[0]);
      }
    } catch {
      cards = [];
    }

    // Validate and sanitize cards
    const validCards = cards
      .filter(c => c.front && c.back && typeof c.front === 'string' && typeof c.back === 'string')
      .map(c => ({ front: c.front.slice(0, 200), back: c.back.slice(0, 500) }))
      .slice(0, 3);

    return NextResponse.json({ cards: validCards });
  } catch (error) {
    console.error('[ai/flashcard] Error:', error);
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 });
  }
}
