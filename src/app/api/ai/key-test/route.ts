import { NextResponse } from 'next/server';
import { chatCompletion, MODELS } from '@/lib/ai-sdk';

export async function POST(request: Request) {
  try {
    // Simple test — just call the configured AI and see if it responds
    const content = await chatCompletion({
      model: MODELS.FAST,
      messages: [
        { role: 'user', content: 'Say "OK" and nothing else.' },
      ],
      temperature: 0,
    });

    if (content) {
      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json({ ok: false, error: 'No response from API' });
    }
  } catch (error: unknown) {
    console.error('[ai/key-test] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'API key test failed';
    return NextResponse.json({ ok: false, error: errorMessage });
  }
}
