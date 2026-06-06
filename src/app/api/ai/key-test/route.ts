import { NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'API key is required' }, { status: 400 });
    }

    // Try a simple call to Gemini using the SDK
    const zai = await ZAI.create();
    const result = await zai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'user', content: 'Say "OK" and nothing else.' },
      ],
      temperature: 0,
    });

    const content = result?.choices?.[0]?.message?.content || result?.content;

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
