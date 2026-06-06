import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'sessionToken is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        {
          role: 'system',
          content: `You are a learning resource curator. Based on the user's profile, suggest 6-8 learning resources. Respond ONLY in this exact JSON array format, no other text:
[{"title": "resource title", "type": "video|article|interactive|podcast", "source": "platform name", "difficulty": "beginner|intermediate|advanced", "url": "https://example.com"}]

User's topic: ${user.topic || 'general learning'}
User's level: ${user.level || 'beginner'}
User's learning style: ${user.learningStyle || 'hands-on'}`,
        },
        { role: 'user', content: 'Suggest learning resources for me.' },
      ],
      temperature: 0.7,
    });

    const text = result?.choices?.[0]?.message?.content || result?.content || '[]';
    let resources;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      resources = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      resources = [];
    }

    const enrichedResources = resources.map((r: Record<string, string>, i: number) => ({
      id: Date.now().toString() + i.toString(),
      title: r.title || 'Untitled Resource',
      type: (['video', 'article', 'interactive', 'podcast'].includes(r.type) ? r.type : 'article') as 'video' | 'article' | 'interactive' | 'podcast',
      source: r.source || 'Web',
      difficulty: r.difficulty || 'beginner',
      url: r.url || undefined,
    }));

    return NextResponse.json({ resources: enrichedResources });
  } catch (error) {
    console.error('[ai/resources] Error:', error);
    return NextResponse.json({ error: 'Failed to generate resources' }, { status: 500 });
  }
}
