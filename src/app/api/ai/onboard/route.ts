import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const ONBOARDING_SYSTEM_PROMPT = `You are the onboarding companion for "Sit With Me" — an AI learning companion app. Your job is to have a warm, Socratic conversation to discover the user's learning goals. 

Ask ONE question at a time. Be genuinely curious and encouraging. Your goal is to discover:
1. **topic** — What do they want to learn? (e.g., "React", "Machine Learning", "Spanish")
2. **vision** — What's their dream outcome? (e.g., "Build my own SaaS", "Get a data science job")
3. **domain** — What field/industry? (e.g., "Web Development", "Data Science", "Language Learning")
4. **level** — Current skill level? (beginner, intermediate, advanced)
5. **minutesPerDay** — How many minutes per day can they dedicate? (number)
6. **learningStyle** — How do they learn best? (visual, reading, hands-on, discussion)
7. **whyNow** — Why are they starting now? (motivation)
8. **obstacle** — What's their biggest obstacle? (time, focus, overwhelm, etc.)

Start by asking what they want to learn. Flow naturally through the questions — don't make it feel like a form. Adapt your questions based on their answers.

CRITICAL RULE: After EVERY response, you MUST include a progress marker on its own line at the very end:
[PROGRESS: {"topic": value_or_null, "vision": value_or_null, "domain": value_or_null, "level": value_or_null, "minutesPerDay": value_or_null, "learningStyle": value_or_null, "whyNow": value_or_null, "obstacle": value_or_null}]
Set a field to its extracted value ONLY if you are confident about it from the conversation so far. Set it to null if you haven't discovered it yet.

After 3-4 exchanges (once you have at minimum: topic, vision, and level), also include [DONE] before the progress marker to signal completion:
[DONE]
[PROGRESS: {"topic":"...","vision":"...","domain":"...","level":"...","minutesPerDay":"...","learningStyle":"...","whyNow":"...","obstacle":"..."}]

Only include fields you are confident about. It's OK to leave fields as null if you couldn't discover them naturally. Aim to complete onboarding in 3-5 exchanges total — be efficient but warm.`;

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

    // Call Gemini
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages,
      temperature: 0.9,
    });

    const reply = result?.choices?.[0]?.message?.content || result?.content || "I'd love to hear more. What would you like to learn?";

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

    // Extract progress data from [PROGRESS: {...}] marker (present in every response)
    let progressData: Record<string, string | null> | undefined;
    const progressMatch = reply.match(/\[PROGRESS:\s*(\{[\s\S]*?\})\]/);
    if (progressMatch) {
      try {
        progressData = JSON.parse(progressMatch[1]);
        // Use progressData as extractedData if done
        if (done) {
          extractedData = progressData;
        }

        // Update user profile incrementally with discovered fields
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

            // Update profile goal if vision is set
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

      // Update user profile with extracted data
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

    // If done and we have progressData, also set extractedData
    if (done && progressData && !extractedData) {
      extractedData = progressData;
    }

    // Clean up the reply — remove [DONE], [PROGRESS: ...] and JSON from visible response
    let cleanReply = reply;
    // Remove [PROGRESS: {...}]
    cleanReply = cleanReply.replace(/\[PROGRESS:\s*\{[\s\S]*?\}\]/g, '').trim();
    // Remove [DONE]
    if (done) {
      const doneIndex = cleanReply.indexOf('[DONE]');
      if (doneIndex >= 0) {
        cleanReply = cleanReply.slice(0, doneIndex).trim();
      }
      // Remove any trailing JSON block
      cleanReply = cleanReply.replace(/\{[\s\S]*"topic"[\s\S]*\}/g, '').trim();
      if (!cleanReply) {
        cleanReply = "Wonderful! I've got a great picture of your learning goals. Let's get started! 🎉";
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
