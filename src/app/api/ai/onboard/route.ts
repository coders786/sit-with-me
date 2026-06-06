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

When you feel you have gathered enough information (at minimum: topic, vision, and level), include the text [DONE] at the very end of your response, followed by a JSON block like this:
[DONE]
{"topic":"...","vision":"...","domain":"...","level":"...","minutesPerDay":"...","learningStyle":"...","whyNow":"...","obstacle":"..."}

Only include fields you are confident about. It's OK to leave fields as null if you couldn't discover them naturally.`;

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

    // Check for [DONE] signal and extract data
    let done = false;
    let extractedData: Record<string, string | null> | undefined;

    if (reply.includes('[DONE]')) {
      done = true;
      // Try to extract JSON after [DONE]
      const doneIndex = reply.indexOf('[DONE]');
      const jsonStr = reply.slice(doneIndex + 5).trim();

      try {
        // Try to parse the JSON block
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

          // Also update profile goal if vision is set
          if (extractedData.vision) {
            const existingProfile = await db.profile.findUnique({ where: { userId: user.id } });
            if (existingProfile) {
              await db.profile.update({
                where: { userId: user.id },
                data: { goal: extractedData.vision },
              });
            }
          }
        }
      }
    }

    // Clean up the reply — remove the [DONE] and JSON from visible response
    let cleanReply = reply;
    if (done) {
      const doneIndex = cleanReply.indexOf('[DONE]');
      if (doneIndex > 0) {
        cleanReply = cleanReply.slice(0, doneIndex).trim();
      } else {
        cleanReply = "Wonderful! I've got a great picture of your learning goals. Let's get started! 🎉";
      }
    }

    return NextResponse.json({
      reply: cleanReply,
      done,
      extractedData,
    });
  } catch (error) {
    console.error('[ai/onboard] Error:', error);
    return NextResponse.json({ error: 'Failed to process onboarding message' }, { status: 500 });
  }
}
