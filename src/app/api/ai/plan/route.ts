import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Session token is required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Build context-aware prompt
    const profileContext: string[] = [];
    if (user.topic) profileContext.push(`Learning topic: ${user.topic}`);
    if (user.vision) profileContext.push(`Vision: ${user.vision}`);
    if (user.domain) profileContext.push(`Domain: ${user.domain}`);
    if (user.level) profileContext.push(`Current level: ${user.level}`);
    if (user.minutesPerDay) profileContext.push(`Available minutes per day: ${user.minutesPerDay}`);
    if (user.learningStyle) profileContext.push(`Preferred learning style: ${user.learningStyle}`);
    if (user.whyNow) profileContext.push(`Motivation: ${user.whyNow}`);
    if (user.obstacle) profileContext.push(`Main obstacle: ${user.obstacle}`);

    const systemPrompt = `You are a learning plan designer for "Sit With Me" — an AI learning companion. Create a personalized 7-day learning plan.

Based on the user's profile, design a week of focused learning. Each day should have:
- A clear theme/focus
- 2-3 specific activities or micro-tasks
- Time estimates (respect their daily minutes)
- A small reflection prompt

The plan should build progressively, start accessible, and end with a meaningful milestone.

Return your response as JSON with this exact structure:
{
  "summary": "A 2-3 sentence overview of the plan",
  "adapts": "How this plan adapts to their level and obstacles",
  "week": [
    {
      "day": 1,
      "theme": "Day theme",
      "tasks": ["Task 1", "Task 2", "Task 3"],
      "minutes": 20,
      "reflection": "A reflection question"
    }
  ]
}

User's learning profile:
${profileContext.join('\n')}`;

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Create my personalized 7-day learning plan.' },
      ],
      temperature: 0.8,
    });

    const content = result?.choices?.[0]?.message?.content || result?.content || '';

    // Parse the JSON from the response
    let planData: { summary: string; adapts: string; week: unknown[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        planData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[ai/plan] JSON parse error:', parseError);
      // Fallback plan
      planData = {
        summary: `A 7-day progressive plan for learning ${user.topic || 'your topic'}.`,
        adapts: 'Adjusted for your current level and time availability.',
        week: Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          theme: `Day ${i + 1}: Exploration`,
          tasks: ['Review fundamentals', 'Practice exercise', 'Reflect on progress'],
          minutes: parseInt(user.minutesPerDay || '20'),
          reflection: 'What clicked for you today?',
        })),
      };
    }

    // Save plan to database
    const plan = await db.plan.create({
      data: {
        userId: user.id,
        summary: planData.summary,
        adapts: planData.adapts,
        weekData: JSON.stringify(planData.week),
      },
    });

    return NextResponse.json({
      plan: {
        id: plan.id,
        summary: planData.summary,
        adapts: planData.adapts,
        week: planData.week,
        createdAt: plan.createdAt,
      },
    });
  } catch (error) {
    console.error('[ai/plan] Error:', error);
    return NextResponse.json({ error: 'Failed to generate learning plan' }, { status: 500 });
  }
}
