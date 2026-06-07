import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';
import { buildSystemPrompt, buildUserProfileContext } from '@/lib/ai-personality';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionToken, message, history, boost } = body;

    if (!sessionToken || !message) {
      return NextResponse.json({ error: 'sessionToken and message are required' }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { sessionToken } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid session token' }, { status: 401 });
    }

    // Update last seen
    await db.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // Save user message
    await db.chatMessage.create({
      data: {
        userId: user.id,
        role: 'user',
        content: message,
      },
    });

    // Build context from user's learning profile
    const profileContext = buildUserProfileContext(user);

    const additionalRules: string[] = [];

    if (boost) {
      additionalRules.push(
        `The person just asked for a BOOST — they need some encouragement right now. Be genuinely uplifting. Celebrate what they've done so far (even small wins count). Then give them one tiny thing they can do right now that feels like a win. Don't be cheesy — be real.`,
      );
    }

    additionalRules.push(
      `If they mention something that sounds like a task or deadline, you can suggest creating one — but don't be pushy about it.`,
      `If they're talking about scheduling or feeling overwhelmed with time, mention the plan feature naturally.`,
      `Keep it under 200 words unless they're asking for something deep. You're having a conversation, not writing an essay.`,
    );

    const systemPrompt = buildSystemPrompt({
      tone: 'chat',
      context: profileContext || undefined,
      additionalRules,
    });

    // Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add history if provided
    if (Array.isArray(history)) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call Gemini via z-ai-web-dev-sdk
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages,
      temperature: 0.9,
    });

    // Extract the reply text
    const reply = result?.choices?.[0]?.message?.content || result?.content || "Hmm, I'm here — tell me more?";

    // Save assistant message
    await db.chatMessage.create({
      data: {
        userId: user.id,
        role: 'assistant',
        content: reply,
      },
    });

    // Increment session count
    await db.user.update({
      where: { id: user.id },
      data: { sessionCount: { increment: 1 } },
    });

    // Check for agentic triggers
    const actions: string[] = [];
    const lowerMessage = message.toLowerCase();
    const lowerReply = reply.toLowerCase();

    if (lowerMessage.includes('task') || lowerMessage.includes('todo') || lowerMessage.includes('deadline') || lowerReply.includes('create a task') || lowerReply.includes('add a task')) {
      actions.push('suggest-task');
    }
    if (lowerMessage.includes('schedule') || lowerMessage.includes('plan') || lowerMessage.includes('calendar') || lowerReply.includes('learning plan')) {
      actions.push('suggest-plan');
    }
    if (lowerMessage.includes('remind') || lowerMessage.includes('nudge') || lowerMessage.includes('notification')) {
      actions.push('suggest-nudge');
    }

    return NextResponse.json({ reply, actions: actions.length > 0 ? actions : undefined });
  } catch (error) {
    console.error('[ai/chat] Error:', error);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
