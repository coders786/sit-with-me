import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

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

    // Build system prompt from user's learning profile
    const profileParts: string[] = [
      'You are "Sit With Me" — a warm, encouraging AI learning companion. You help people learn through Socratic dialogue, adaptive planning, and emotional support. Be conversational, concise, and genuinely curious.',
    ];

    if (user.topic) profileParts.push(`Their learning topic: ${user.topic}`);
    if (user.vision) profileParts.push(`Their vision: ${user.vision}`);
    if (user.domain) profileParts.push(`Domain: ${user.domain}`);
    if (user.level) profileParts.push(`Current level: ${user.level}`);
    if (user.minutesPerDay) profileParts.push(`Available minutes per day: ${user.minutesPerDay}`);
    if (user.learningStyle) profileParts.push(`Preferred learning style: ${user.learningStyle}`);
    if (user.whyNow) profileParts.push(`Why they are learning now: ${user.whyNow}`);
    if (user.obstacle) profileParts.push(`Their main obstacle: ${user.obstacle}`);

    if (boost) {
      profileParts.push('The user asked for a BOOST — be extra encouraging, celebrate their progress, and offer a motivational micro-challenge.');
    }

    profileParts.push(
      'When the user mentions tasks or deadlines, acknowledge them and suggest creating a task.',
      'When the user mentions scheduling or time management, suggest using the plan feature.',
      'Keep responses under 200 words unless the user asks for depth. Use markdown for formatting when helpful.',
    );

    const systemPrompt = profileParts.join('\n');

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
    const reply = result?.choices?.[0]?.message?.content || result?.content || 'I am here with you. Could you tell me more?';

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
