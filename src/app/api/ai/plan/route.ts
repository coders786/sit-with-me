import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

Based on the user's profile, design a week of focused learning. Each day should be achievable in their daily minutes, with one concrete first action.

Return your response as JSON with this EXACT structure (no markdown, no code blocks):
{
  "summary": "A 2-3 sentence overview of the plan",
  "adapts": "How this plan adapts to their level and obstacles",
  "week": [
    {
      "day": "Monday",
      "focus": "Short focus title for this day",
      "minutes": 30,
      "firstStep": "One concrete first action they can take right away",
      "time": "18:00"
    }
  ]
}

Use actual day names (Monday through Sunday) for the "day" field.
The "focus" should be a short descriptive phrase (e.g., "React Components & Props").
The "firstStep" should be a concrete, actionable step.
The "time" should be a suggested study time in HH:MM format.

User's learning profile:
${profileContext.join('\n')}`;

    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: 'Create my personalized 7-day learning plan.' },
      ],
      temperature: 0.8,
    });

    const content = result?.choices?.[0]?.message?.content || result?.content || '';

    // Parse the JSON from the response
    let planData: { summary: string; adapts: string; week: Array<{ day: string; focus: string; minutes: number; firstStep: string; time?: string }> };
    try {
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        planData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[ai/plan] JSON parse error:', parseError, 'Content:', content.slice(0, 200));
      // Fallback plan with correct format
      planData = {
        summary: `A 7-day progressive plan for learning ${user.topic || 'your topic'}.`,
        adapts: 'Adjusted for your current level and time availability.',
        week: DAYS.map((dayName, i) => ({
          day: dayName,
          focus: `${user.topic || 'Learning'} Exploration - Part ${i + 1}`,
          minutes: parseInt(user.minutesPerDay || '20'),
          firstStep: `Start with the basics of ${user.topic || 'your topic'} and practice for 15 minutes`,
          time: '18:00',
        })),
      };
    }

    // Normalize week data to match frontend expectations
    const normalizedWeek = (planData.week || []).map((day, i) => ({
      day: typeof day.day === 'number' ? DAYS[(day.day - 1) % 7] || DAYS[i] : String(day.day || DAYS[i]),
      focus: (day as Record<string, unknown>).focus || (day as Record<string, unknown>).theme || `Day ${i + 1} Focus`,
      minutes: day.minutes || parseInt(user.minutesPerDay || '20'),
      firstStep: (day as Record<string, unknown>).firstStep || ((day as Record<string, unknown>).tasks ? ((day as Record<string, unknown>).tasks as string[])[0] : 'Start with fundamentals') as string,
      time: (day as Record<string, unknown>).time || '18:00',
    }));

    // Save plan to database
    const plan = await db.plan.create({
      data: {
        userId: user.id,
        summary: planData.summary,
        adapts: planData.adapts,
        weekData: JSON.stringify(normalizedWeek),
      },
    });

    return NextResponse.json({
      plan: {
        id: plan.id,
        summary: planData.summary,
        adapts: planData.adapts,
        week: normalizedWeek,
        createdAt: plan.createdAt,
      },
    });
  } catch (error) {
    console.error('[ai/plan] Error:', error);
    return NextResponse.json({ error: 'Failed to generate learning plan' }, { status: 500 });
  }
}
