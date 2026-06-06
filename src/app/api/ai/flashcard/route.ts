import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

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

    const systemPrompt = `Extract 1-3 key concepts from this learning content as flashcards. Return a JSON array of objects with "front" and "back" properties. Front is the question/concept name, back is the explanation/answer. Return ONLY the JSON array, no other text.

Example format:
[{"front": "What is X?", "back": "X is..."}]`;

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.slice(0, 2000) },
      ],
      temperature: 0.5,
    });

    const rawText = result?.choices?.[0]?.message?.content || result?.content || '[]';

    // Parse the JSON array from the response
    let cards: Array<{ front: string; back: string }> = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cards = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, return empty array
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
