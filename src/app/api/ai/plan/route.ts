import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatCompletion } from '@/lib/ai-sdk';
import { buildSystemPrompt, buildUserProfileContext } from '@/lib/ai-personality';

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

    const profileContext = buildUserProfileContext(user);

    const systemPrompt = buildSystemPrompt({
      tone: 'plan',
      context: profileContext || undefined,
      additionalRules: [
        `Create a 7-day learning plan. Return it as JSON with this EXACT structure (no markdown, no code blocks):`,
        `{`,
        `  "summary": "A couple sentences about the plan — write it like you're telling a friend what the week looks like",`,
        `  "adapts": "How this plan actually fits THEIR life, not a generic template",`,
        `  "week": [`,
        `    {`,
        `      "day": "Monday",`,
        `      "focus": "Short, punchy focus for this day (like 'Getting Your Feet Wet' not 'Introduction to Fundamental Concepts')",`,
        `      "minutes": 30,`,
        `      "firstStep": "One thing they can do RIGHT NOW to get started — make it dead simple",`,
        `      "time": "18:00"`,
        `    }`,
        `  ]`,
        `}`,
        ``,
        `Use real day names (Monday through Sunday).`,
        `The "focus" should feel like a chapter title, not a syllabus entry.`,
        `The "firstStep" should be something you'd actually tell a friend to do — concrete and immediate.`,
        `The "time" is a suggested study time in HH:MM format.`,
        `Make the plan feel doable and a little exciting, not like homework.`,
      ],
    });

    const content = await chatCompletion({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Create my personalized 7-day learning plan.' },
      ],
      temperature: 0.8,
    }) || '';

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
      // Fallback plan
      planData = {
        summary: `A week of getting into ${user.topic || 'your topic'}, one step at a time.`,
        adapts: 'Built around your schedule and where you\'re starting from.',
        week: DAYS.map((dayName, i) => ({
          day: dayName,
          focus: `${user.topic || 'Learning'} — Day ${i + 1}`,
          minutes: parseInt(user.minutesPerDay || '20'),
          firstStep: `Start with something small in ${user.topic || 'your topic'} — even 5 minutes counts.`,
          time: '18:00',
        })),
      };
    }

    // Normalize week data
    const normalizedWeek = (planData.week || []).map((day, i) => ({
      day: typeof day.day === 'number' ? DAYS[(day.day - 1) % 7] || DAYS[i] : String(day.day || DAYS[i]),
      focus: (day as Record<string, unknown>).focus || (day as Record<string, unknown>).theme || `Day ${i + 1} Focus`,
      minutes: day.minutes || parseInt(user.minutesPerDay || '20'),
      firstStep: (day as Record<string, unknown>).firstStep || ((day as Record<string, unknown>).tasks ? ((day as Record<string, unknown>).tasks as string[])[0] : 'Start with something small') as string,
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
