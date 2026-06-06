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
          content: `You are a learning challenge generator. Based on the user's profile, create ONE daily learning challenge. The challenge should be achievable in 10-20 minutes. Respond ONLY in this exact JSON format, no other text:
{"title": "short title", "description": "1-2 sentence description of what to do", "xpReward": 20}

User's topic: ${user.topic || 'general learning'}
User's level: ${user.level || 'beginner'}
User's learning style: ${user.learningStyle || 'hands-on'}
User's obstacle: ${user.obstacle || 'none'}`,
        },
        { role: 'user', content: 'Generate a daily challenge for me.' },
      ],
      temperature: 1.0,
    });

    const text = result?.choices?.[0]?.message?.content || result?.content || '{}';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: 'Review a concept', description: 'Pick one thing you learned recently and explain it in your own words.', xpReward: 20 };
    } catch {
      parsed = { title: 'Review a concept', description: 'Pick one thing you learned recently and explain it in your own words.', xpReward: 20 };
    }

    const challenge = {
      id: Date.now().toString(),
      title: parsed.title || 'Daily Challenge',
      description: parsed.description || 'Complete this challenge to earn XP.',
      xpReward: parsed.xpReward || 20,
      completed: false,
    };

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('[ai/challenge] Error:', error);
    return NextResponse.json({ error: 'Failed to generate challenge' }, { status: 500 });
  }
}
