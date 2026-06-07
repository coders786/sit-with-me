import { NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/ai-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'API key is required' }, { status: 400 });
    }

    // Try a simple call to Gemini using the dual-sdk
    const content = await chatCompletion({
      model: 'gemini-2.0-flash',
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
