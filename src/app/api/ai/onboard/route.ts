import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatCompletion, MODELS } from '@/lib/ai-sdk';
import { buildSystemPrompt } from '@/lib/ai-personality';

const ONBOARDING_ADDITIONAL_RULES = [
  `WHAT YOU'RE DOING: Having a warm, real conversation to learn about someone. You want to discover these things naturally (not like a questionnaire):`,
  `1. topic — What lights them up? What do they want to learn?`,
  `2. vision — What's the dream? Not just "learn React" but "build my own app and quit my job" kind of stuff`,
  `3. domain — What world does this live in? Tech, art, languages, business...`,
  `4. level — Are they just starting out, getting somewhere, or already pretty deep?`,
  `5. minutesPerDay — How much time can they realistically put in? (just a number)`,
  `6. learningStyle — Do they like watching, reading, doing, talking it through?`,
  `7. whyNow — What made them decide "today's the day"?`,
  `8. obstacle — What's the thing that usually stops them? Time? Focus? Overwhelm? Fear?`,
  ``,
  `Ask ONE thing at a time. Let the conversation flow — don't make it feel like an interview. React to what they say before moving on. If they mention something interesting, dig into it a bit.`,
  ``,
  `IMPORTANT — After EVERY response, include a progress marker on its own line at the very end:`,
  `[PROGRESS: {"topic": value_or_null, "vision": value_or_null, "domain": value_or_null, "level": value_or_null, "minutesPerDay": value_or_null, "learningStyle": value_or_null, "whyNow": value_or_null, "obstacle": value_or_null}]`,
  `Only fill in a field if you're pretty sure about it from the conversation. Leave it null if you haven't figured it out yet.`,
  ``,
  `After 3-4 good exchanges (once you've got at minimum: topic, vision, and level), add [DONE] before the progress marker:`,
  `[DONE]`,
  `[PROGRESS: {"topic":"...","vision":"...","domain":"...","level":"...","minutesPerDay":"...","learningStyle":"...","whyNow":"...","obstacle":"..."}]`,
  ``,
  `Don't stretch it out forever — aim to wrap up in 3-5 exchanges. Be warm but efficient. You want them to feel like they just had a great conversation, not sat through intake forms.`,
];

const ONBOARDING_SYSTEM_PROMPT = buildSystemPrompt({
  tone: 'onboarding',
  additionalRules: ONBOARDING_ADDITIONAL_RULES,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, message } = body;

    if (!sessionToken || !message) {
      return NextResponse.json({ error: 'sessionToken and message are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Save user message as onboarding
    await db.chatMessage.create({
      data: {
        userId: user.id,
        role: 'user',
        content: message,
        isOnboarding: true,
      },
    });

    // Fetch recent onboarding history
    const recentMessages = await db.chatMessage.findMany({
      where: { userId: user.id, isOnboarding: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
    ];

    for (const msg of recentMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Call AI via dual-mode SDK
    const reply = await chatCompletion({ model: MODELS.SMART, messages, temperature: 0.9 });

    // Save assistant message
    await db.chatMessage.create({
      data: {
        userId: user.id,
        role: 'assistant',
        content: reply,
        isOnboarding: true,
      },
    });

    // Check for [DONE] signal
    let done = false;
    let extractedData: Record<string, string | null> | undefined;

    if (reply.includes('[DONE]')) {
      done = true;
    }

    // Extract progress data from [PROGRESS: {...}] marker
    let progressData: Record<string, string | null> | undefined;
    const progressMatch = reply.match(/\[PROGRESS:\s*(\{[\s\S]*?\})\]/);
    if (progressMatch) {
      try {
        progressData = JSON.parse(progressMatch[1]);
        if (done) {
          extractedData = progressData;
        }

        if (progressData) {
          const updateData: Record<string, unknown> = {};
          if (progressData.topic && !user.topic) updateData.topic = progressData.topic;
          if (progressData.vision && !user.vision) updateData.vision = progressData.vision;
          if (progressData.domain && !user.domain) updateData.domain = progressData.domain;
          if (progressData.level && !user.level) updateData.level = progressData.level;
          if (progressData.minutesPerDay && !user.minutesPerDay) updateData.minutesPerDay = String(progressData.minutesPerDay);
          if (progressData.learningStyle && !user.learningStyle) updateData.learningStyle = progressData.learningStyle;
          if (progressData.whyNow && !user.whyNow) updateData.whyNow = progressData.whyNow;
          if (progressData.obstacle && !user.obstacle) updateData.obstacle = progressData.obstacle;

          if (Object.keys(updateData).length > 0) {
            await db.user.update({
              where: { id: user.id },
              data: updateData,
            });

            if (progressData.vision && !user.vision) {
              const existingProfile = await db.profile.findUnique({ where: { userId: user.id } });
              if (existingProfile) {
                await db.profile.update({
                  where: { userId: user.id },
                  data: { goal: progressData.vision },
                });
              }
            }
          }
        }
      } catch (parseError) {
        console.error('[ai/onboard] Progress JSON parse error:', parseError);
      }
    }

    // Fallback: If done but no progressData, try extracting JSON after [DONE]
    if (done && !progressData) {
      const doneIndex = reply.indexOf('[DONE]');
      const jsonStr = reply.slice(doneIndex + 5).trim();
      try {
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('[ai/onboard] JSON parse error:', parseError);
      }

      if (extractedData) {
        const updateData: Record<string, unknown> = {};
        if (extractedData.topic) updateData.topic = extractedData.topic;
        if (extractedData.vision) updateData.vision = extractedData.vision;
        if (extractedData.domain) updateData.domain = extractedData.domain;
        if (extractedData.level) updateData.level = extractedData.level;
        if (extractedData.minutesPerDay) updateData.minutesPerDay = extractedData.minutesPerDay;
        if (extractedData.learningStyle) updateData.learningStyle = extractedData.learningStyle;
        if (extractedData.whyNow) updateData.whyNow = extractedData.whyNow;
        if (extractedData.obstacle) updateData.obstacle = extractedData.obstacle;

        if (Object.keys(updateData).length > 0) {
          await db.user.update({
            where: { id: user.id },
            data: updateData,
          });
        }
      }
    }

    if (done && progressData && !extractedData) {
      extractedData = progressData;
    }

    // Clean up the reply — remove markers from visible response
    let cleanReply = reply;
    cleanReply = cleanReply.replace(/\[PROGRESS:\s*\{[\s\S]*?\}\]/g, '').trim();
    if (done) {
      const doneIndex = cleanReply.indexOf('[DONE]');
      if (doneIndex >= 0) {
        cleanReply = cleanReply.slice(0, doneIndex).trim();
      }
      cleanReply = cleanReply.replace(/\{[\s\S]*"topic"[\s\S]*\}/g, '').trim();
      if (!cleanReply) {
        cleanReply = "That's everything I need — let's get you started! 🎉";
      }
    }

    return NextResponse.json({
      reply: cleanReply,
      done,
      extractedData: extractedData || progressData,
      progressData,
    });
  } catch (error) {
    console.error('[ai/onboard] Error:', error);
    return NextResponse.json({ error: 'Failed to process onboarding message' }, { status: 500 });
  }
}
