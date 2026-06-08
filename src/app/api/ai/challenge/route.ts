import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatCompletion, MODELS } from '@/lib/ai-sdk';
import { buildSystemPrompt, buildUserProfileContext } from '@/lib/ai-personality';

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

    const profileContext = buildUserProfileContext(user);

    const systemPrompt = buildSystemPrompt({
      tone: 'challenge',
      context: profileContext || undefined,
      additionalRules: [
        `Create ONE daily learning challenge. It should take 10-20 minutes and feel achievable — not intimidating.`,
        `Return ONLY JSON, no other text:`,
        `{"title": "a catchy title that makes you want to try it", "description": "1-2 sentences explaining what to do — write it like you're daring a friend", "xpReward": 20}`,
        ``,
        `Make the title punchy and fun. Make the description feel like a personal challenge, not homework.`,
      ],
    });

    const text = await chatCompletion({
      model: MODELS.FAST,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Give me a challenge for today.' },
      ],
      temperature: 1.0,
    }) || '{}';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: 'Explain it to a friend', description: 'Pick one thing you learned recently and try explaining it to someone who knows nothing about it — out loud or in writing. If you can explain it simply, you really get it.', xpReward: 20 };
    } catch {
      parsed = { title: 'Explain it to a friend', description: 'Pick one thing you learned recently and try explaining it to someone who knows nothing about it — out loud or in writing. If you can explain it simply, you really get it.', xpReward: 20 };
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
